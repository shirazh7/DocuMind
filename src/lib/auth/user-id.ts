// ── USER IDENTITY: DEMO-GRADE, TWO-TIER FALLBACK ───────────────────────
//
// Returns a stable string identifier used for rate limiting and chat session
// ownership. Not a security boundary — the cookie is not signed or verified,
// so a client can forge any username. For a production system replace with
// Clerk or Descope JWTs that carry a verified sub claim.
//
// Tier 1 — cookie: the "documind-auth" cookie is set by /api/auth/login as
// base64("username:timestamp"). We extract only the username prefix so the
// identity is stable across re-logins with the same account.
// Format: "user:alice"
//
// Tier 2 — IP: used for unauthenticated requests and local dev. We take only
// the first IP in x-forwarded-for because subsequent entries are added by
// reverse proxies we don't control and can be spoofed. Vercel guarantees the
// first entry is the client IP on production; locally it may be undefined.
// Format: "ip:1.2.3.4" or "ip:unknown"
//
// The "ip:unknown" fallback means all unidentified clients share one rate
// limit bucket — acceptable for a demo, a problem in production.
import { cookies, headers } from "next/headers";

export async function getCurrentUserId() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("documind-auth")?.value;

  if (authCookie) {
    try {
      const decoded = Buffer.from(authCookie, "base64").toString("utf8");
      const username = decoded.split(":")[0]?.trim();
      if (username) {
        return `user:${username}`;
      }
    } catch {
      // Malformed base64 — fall through to IP identity.
    }
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

