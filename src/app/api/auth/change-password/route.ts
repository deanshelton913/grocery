/**
 * POST /api/auth/change-password
 * Body: { currentPassword: string, newPassword: string }
 * Requires session cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findListBySlug, updateListPassword } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Both passwords are required" }, { status: 400 });
    }
    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: "New password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const list = await findListBySlug(session.slug);
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

    const ok = await verifyPassword(currentPassword, list.password_hash);
    if (!ok) return NextResponse.json({ error: "Current password is wrong" }, { status: 401 });

    const newHash = await hashPassword(newPassword);
    await updateListPassword(session.listId, newHash);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[change-password]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
