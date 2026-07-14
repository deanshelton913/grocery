/**
 * GET  /api/trips  — fetch all trips for the session's list
 * POST /api/trips  — upsert a trip (full trip object)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTrips, upsertTrip } from "@/lib/db";
import type { Trip } from "@/lib/types";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const trips = await getTrips(session.listId);
    return NextResponse.json({ trips });
  } catch (e) {
    console.error("[GET /api/trips]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const trip: Trip = await req.json();
    if (!trip?.id || !trip?.store) {
      return NextResponse.json({ error: "Invalid trip" }, { status: 400 });
    }

    await upsertTrip(session.listId, trip);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/trips]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
