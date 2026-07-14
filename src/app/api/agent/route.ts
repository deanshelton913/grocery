/**
 * Agent API — rate-limited, token-authenticated endpoint for programmatic updates.
 *
 * Authentication: Bearer token in Authorization header
 *   Authorization: Bearer <api_token>
 *
 * Rate limit: 30 requests / minute per token (Upstash sliding window)
 *
 * -----------------------------------------------------------------------
 * GET /api/agent
 *   Returns the full list of trips.
 *
 * POST /api/agent
 *   Upsert a trip. Body: Trip object (same shape as the app uses).
 *
 * PATCH /api/agent
 *   Update a single item's status.
 *   Body: { tripId: string, itemId: string, status: "pending"|"used"|"partial"|"wasted" }
 *
 * DELETE /api/agent?tripId=<id>
 *   Delete a trip by ID.
 * -----------------------------------------------------------------------
 */
import { NextRequest, NextResponse } from "next/server";
import { findListByApiToken, getTrips, upsertTrip, deleteTrip, updateItemStatus } from "@/lib/db";
import { getRatelimit } from "@/lib/ratelimit";
import type { Trip, Item } from "@/lib/types";

const VALID_STATUSES: Item["status"][] = ["pending", "used", "partial", "wasted"];

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return findListByApiToken(token);
}

async function checkRateLimit(token: string): Promise<{ limited: boolean; reset: number }> {
  try {
    const rl = getRatelimit();
    const { success, reset } = await rl.limit(token);
    return { limited: !success, reset };
  } catch {
    // If Redis is down, fail open (don't block legitimate requests)
    return { limited: false, reset: 0 };
  }
}

function getToken(req: NextRequest): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export async function GET(req: NextRequest) {
  const list = await authenticate(req);
  if (!list) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const { limited, reset } = await checkRateLimit(getToken(req));
  if (limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Retry after reset time." },
      { status: 429, headers: { "X-RateLimit-Reset": String(reset) } }
    );
  }

  const trips = await getTrips(list.id);
  return NextResponse.json({ trips });
}

export async function POST(req: NextRequest) {
  const list = await authenticate(req);
  if (!list) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const { limited, reset } = await checkRateLimit(getToken(req));
  if (limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "X-RateLimit-Reset": String(reset) } }
    );
  }

  const trip: Trip = await req.json();
  if (!trip?.id || !trip?.store) {
    return NextResponse.json({ error: "Invalid trip object" }, { status: 400 });
  }

  await upsertTrip(list.id, trip);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const list = await authenticate(req);
  if (!list) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const { limited, reset } = await checkRateLimit(getToken(req));
  if (limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "X-RateLimit-Reset": String(reset) } }
    );
  }

  const { tripId, itemId, status } = await req.json();
  if (!tripId || !itemId || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Required: tripId, itemId, status (pending|used|partial|wasted)" },
      { status: 400 }
    );
  }

  await updateItemStatus(list.id, tripId, itemId, status);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const list = await authenticate(req);
  if (!list) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const { limited, reset } = await checkRateLimit(getToken(req));
  if (limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "X-RateLimit-Reset": String(reset) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId query param required" }, { status: 400 });

  await deleteTrip(list.id, tripId);
  return NextResponse.json({ ok: true });
}
