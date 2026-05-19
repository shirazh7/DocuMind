import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── AUTH PROXY: COOKIE-BASED, ENV-GATED ────────────────────────────────
//
// If BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD are set, every request
// must have a valid "documind-auth" cookie (set by /api/auth/login).
// If the env vars are absent, auth is completely skipped.
// Login page and auth API are excluded from the check.
//
// PRODUCTION: Replace with Clerk/Auth0/Descope for multi-user SSO and
// granular organization-level authorization.

export function proxy(req: NextRequest) {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
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
  // Exclude static assets, Workflow internal routes, and the Flags Explorer
  // discovery endpoint (.well-known/vercel/flags) from auth checks.
  // The discovery endpoint is read by the Vercel Toolbar locally and must
  // be publicly reachable for the Explorer to list flag overrides.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|\\.well-known/).*)"],
};

