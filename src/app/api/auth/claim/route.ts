/**
 * POST /api/auth/claim
 * Create a new list with a slug + password.
 * Body: { slug: string, password: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createList, findListBySlug } from "@/lib/db";
import { hashPassword, generateApiToken, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { slug, password } = await req.json();

    if (!slug || !password) {
      return NextResponse.json({ error: "slug and password are required" }, { status: 400 });
    }

    const cleanSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (cleanSlug.length < 2 || cleanSlug.length > 40) {
      return NextResponse.json({ error: "Title must be 2–40 characters" }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const existing = await findListBySlug(cleanSlug);
    if (existing) {
      return NextResponse.json({ error: "That list name is already taken" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const apiToken = generateApiToken();
    const list = await createList(cleanSlug, passwordHash, apiToken);

    const sessionToken = await createSession({ listId: list.id, slug: list.slug });

    const res = NextResponse.json({ slug: list.slug, apiToken: list.api_token });
    res.headers.append("Set-Cookie", setSessionCookie(sessionToken));
    return res;
  } catch (e) {
    console.error("[claim]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
