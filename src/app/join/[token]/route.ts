/**
 * GET /join/[token]
 *
 * Deep link that auto-authenticates using an API token and redirects to /ledger.
 * Share this URL with family members so they can add the app to their phone
 * without needing to know the password.
 *
 * Example: https://grocery-alpha-two.vercel.app/join/abc123...
 */
import { NextRequest, NextResponse } from "next/server";
import { findListByApiToken } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const list = await findListByApiToken(token);
  if (!list) {
    return NextResponse.redirect(new URL("/?error=invalid-link", _req.url));
  }

  const sessionToken = await createSession({ listId: list.id, slug: list.slug });

  const res = NextResponse.redirect(new URL("/ledger", _req.url));
  res.headers.append("Set-Cookie", setSessionCookie(sessionToken));
  return res;
}
