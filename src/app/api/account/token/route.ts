/**
 * GET  /api/account/token  — return current api token
 * POST /api/account/token  — rotate api token, returns new one
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findListBySlug, rotateApiToken } from "@/lib/db";
import { generateApiToken } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const list = await findListBySlug(session.slug);
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ apiToken: list.api_token });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const newToken = generateApiToken();
  await rotateApiToken(session.listId, newToken);
  return NextResponse.json({ apiToken: newToken });
}
