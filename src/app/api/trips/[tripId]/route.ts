/**
 * DELETE /api/trips/[tripId]
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteTrip } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    await deleteTrip(session.listId, params.tripId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/trips]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
