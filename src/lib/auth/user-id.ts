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
      // Ignore malformed cookie values and fall through to IP identity.
    }
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

