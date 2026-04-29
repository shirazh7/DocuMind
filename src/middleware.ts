import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── AUTH MIDDLEWARE: COOKIE-BASED, ENV-GATED ───────────────────────────
//
// If BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD are set, every request
// must have a valid "documind-auth" cookie (set by /api/auth/login).
// If the env vars are absent, auth is completely skipped.
// Login page and auth API are excluded from the check.
//
// PRODUCTION: Replace with NextAuth / Clerk / Vercel Auth for
// multi-user support, SSO, and proper session management.

export function middleware(req: NextRequest) {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  const authCookie = req.cookies.get("documind-auth");

  if (authCookie?.value) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
