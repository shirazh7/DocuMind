// ── RATE LIMITING: UPSTASH SLIDING WINDOW, FAIL-OPEN ───────────────────
//
// Protects /api/chat from spend exhaustion. A single unauthenticated client
// sending rapid requests can burn an AI Gateway key in minutes — this cap
// prevents that without requiring hard auth.
//
// Algorithm: sliding window (not fixed window). Fixed windows allow burst
// at boundary edges (e.g. 20 requests at 00:59 + 20 at 01:00). Sliding
// window smooths that by counting requests in the trailing 60 seconds.
//
// Limit: 20 requests per minute per user/IP. This allows a conversational
// pace (~3 req/s burst, ~0.33 req/s sustained) while blocking scripted abuse.
//
// Fail-open: if Upstash credentials are absent the limiter returns success.
// This is intentional — rate limiting is a spend control, not a security gate.
// The app must remain functional in dev/test environments without Redis.
//
// Dual env var names: Vercel Marketplace provisions KV_REST_API_* but the
// Upstash SDK defaults to UPSTASH_REDIS_REST_*. We check both so the app
// works without extra env aliases regardless of which path was used to
// install Upstash.
//
// Singleton: the Ratelimit instance holds an HTTP connection pool to Upstash.
// Recreating it per request would leak connections in a long-running Node
// process. cachedRedisKey invalidates the singleton if credentials change
// (e.g. env rotation without a process restart).
//
// prefix "documind:chat" namespaces keys in Redis so this app's limits don't
// collide with other apps sharing the same Upstash instance.
// analytics: true enables Upstash's request analytics dashboard at no cost.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;
let cachedRedisKey: string | null = null;

function resolveRedisConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? null;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? null;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

function getRateLimiter() {
  const redisConfig = resolveRedisConfig();
  if (!redisConfig) {
    return null;
  }

  const redisKey = `${redisConfig.url}|${redisConfig.token}`;
  if (!ratelimit || cachedRedisKey !== redisKey) {
    const redis = new Redis({
      url: redisConfig.url,
      token: redisConfig.token,
    });

    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: true,
      prefix: "documind:chat",
    });
    cachedRedisKey = redisKey;
  }

  return ratelimit;
}

export async function enforceChatRateLimit(identifier: string) {
  const limiter = getRateLimiter();

  if (!limiter) {
    return {
      success: true as const,
      limit: null,
      remaining: null,
      reset: null,
      reason: "Rate limiting disabled: Upstash credentials not configured.",
    };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    reason: result.success ? null : "Rate limit exceeded. Try again shortly.",
  };
}

