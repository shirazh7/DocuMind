// ── RATE LIMIT: PLATFORM CAPABILITIES PAGE REFRESH ─────────────────────
//
// Mirrors the structure of lib/rate-limit/chat.ts but with a separate
// key prefix ("documind:demo") and a higher limit (30 req/min vs 20).
// Why a separate limiter rather than reusing chat.ts:
//   - Different feature, different abuse profile: the refresh button is
//     cheaper than a chat request (no LLM call) but still hits Neon
//     and Redis on every invocation, so it still needs protection.
//   - Independent limits mean a burst of demo page refreshes can't
//     consume the chat rate-limit budget, and vice versa.
//   - Separate key prefix keeps Redis storage and observability clean.

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
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: true,
      prefix: "documind:demo",
    });
    cachedRedisKey = redisKey;
  }

  return ratelimit;
}

/**
 * Checks whether `identifier` has exceeded the Platform Capabilities refresh
 * rate limit (30 req/min). Returns `{ success, remaining, reset }`.
 * Fails open when Upstash credentials are absent.
 */
export async function enforceDemoRefreshRateLimit(identifier: string) {
  const limiter = getRateLimiter();
  if (!limiter) {
    return {
      success: true as const,
      reset: null as number | null,
      remaining: null as number | null,
    };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    reset: result.reset,
    remaining: result.remaining,
  };
}

