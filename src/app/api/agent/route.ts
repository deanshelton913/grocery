/**
 * Pantry Ledger Agent API
 * Token-authenticated, rate-limited REST API for AI agents and scripts.
 *
 * Auth:  Authorization: Bearer <api_token>
 * Limit: 30 requests / minute (Upstash sliding window)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/agent                      List all trips + items
 * POST /api/agent                      Create or replace a full trip
 * PUT  /api/agent                      Update fields on a single item
 * PATCH /api/agent                     Cycle / set a single item's status
 * DELETE /api/agent?tripId=<id>        Delete a whole trip
 * DELETE /api/agent?tripId=<id>&itemId=<id>  Delete a single item from a trip
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from "next/server";
import { findListByApiToken, getTrips, upsertTrip, deleteTrip, updateItemStatus } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { getRatelimit } from "@/lib/ratelimit";
import type { Trip, Item } from "@/lib/types";

const VALID_STATUSES: Item["status"][] = ["pending", "used", "partial", "wasted"];

// ── auth ──────────────────────────────────────────────────────────────────────

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return findListByApiToken(token);
}

function getToken(req: NextRequest): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

async function checkRateLimit(token: string): Promise<{ limited: boolean; reset: number }> {
  try {
    const rl = getRatelimit();
    const { success, reset } = await rl.limit(token);
    return { limited: !success, reset };
  } catch {
    return { limited: false, reset: 0 }; // fail open if Redis is down
  }
}

function rateLimitResponse(reset: number) {
  return NextResponse.json(
    { error: "Rate limit exceeded. Retry after reset time." },
    { status: 429, headers: { "X-RateLimit-Reset": String(reset) } }
  );
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const list = await authenticate(req);
  if (!list) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const { limited, reset } = await checkRateLimit(getToken(req));
  if (limited) return rateLimitResponse(reset);

  const trips = await getTrips(list.id);
  return NextResponse.json({ trips });
}

// ── POST ──────────────────────────────────────────────────────────────────────
// Upsert a full trip (create or replace)

export async function POST(req: NextRequest) {
  const list = await authenticate(req);
  if (!list) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const { limited, reset } = await checkRateLimit(getToken(req));
  if (limited) return rateLimitResponse(reset);

  const trip: Trip = await req.json();
  if (!trip?.id || !trip?.store) {
    return NextResponse.json({ error: "Required: id, store" }, { status: 400 });
  }

  await upsertTrip(list.id, trip);
  return NextResponse.json({ ok: true });
}

// ── PUT ───────────────────────────────────────────────────────────────────────
// Update individual fields on an existing item
// Body: { tripId, itemId, fields: Partial<Item> }

export async function PUT(req: NextRequest) {
  const list = await authenticate(req);
  if (!list) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const { limited, reset } = await checkRateLimit(getToken(req));
  if (limited) return rateLimitResponse(reset);

  const body = await req.json();
  const { tripId, itemId, fields } = body as {
    tripId: string;
    itemId: string;
    fields: Partial<Pick<Item, "name" | "category" | "price" | "qty" | "status">>;
  };

  if (!tripId || !itemId || !fields || typeof fields !== "object") {
    return NextResponse.json(
      { error: "Required: tripId, itemId, fields (object with fields to update)" },
      { status: 400 }
    );
  }

  // Validate status if provided
  if (fields.status && !VALID_STATUSES.includes(fields.status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const allowed = ["name", "category", "price", "qty", "status"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in fields) updates[key] = (fields as Record<string, unknown>)[key];
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from("items")
    .update(updates)
    .eq("id", itemId)
    .eq("trip_id", tripId)
    .eq("list_id", list.id);

  if (error) {
    console.error("[PUT /api/agent]", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Set item status (convenience shorthand for PUT)
// Body: { tripId, itemId, status }

export async function PATCH(req: NextRequest) {
  const list = await authenticate(req);
  if (!list) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const { limited, reset } = await checkRateLimit(getToken(req));
  if (limited) return rateLimitResponse(reset);

  const { tripId, itemId, status } = await req.json();
  if (!tripId || !itemId || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Required: tripId, itemId, status (${VALID_STATUSES.join("|")})` },
      { status: 400 }
    );
  }

  await updateItemStatus(list.id, tripId, itemId, status);
  return NextResponse.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// ?tripId=<id>              → delete the whole trip
// ?tripId=<id>&itemId=<id>  → delete a single item from a trip

export async function DELETE(req: NextRequest) {
  const list = await authenticate(req);
  if (!list) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const { limited, reset } = await checkRateLimit(getToken(req));
  if (limited) return rateLimitResponse(reset);

  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");
  const itemId = searchParams.get("itemId");

  if (!tripId) {
    return NextResponse.json({ error: "tripId query param is required" }, { status: 400 });
  }

  if (itemId) {
    // Delete single item
    const db = supabaseAdmin();
    const { error } = await db
      .from("items")
      .delete()
      .eq("id", itemId)
      .eq("trip_id", tripId)
      .eq("list_id", list.id);

    if (error) {
      console.error("[DELETE item /api/agent]", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Delete whole trip (cascades to items)
  await deleteTrip(list.id, tripId);
  return NextResponse.json({ ok: true });
}
