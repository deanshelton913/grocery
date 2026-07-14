/**
 * POST /api/auth/login
 * Body: { slug: string, password: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { findListBySlug } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { slug, password } = await req.json();
    if (!slug || !password) {
      return NextResponse.json({ error: "slug and password are required" }, { status: 400 });
    }

    const cleanSlug = slug.trim().toLowerCase();
    const list = await findListBySlug(cleanSlug);
    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const ok = await verifyPassword(password, list.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }

    const sessionToken = await createSession({ listId: list.id, slug: list.slug });
    const res = NextResponse.json({ slug: list.slug });
    res.headers.append("Set-Cookie", setSessionCookie(sessionToken));
    return res;
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
