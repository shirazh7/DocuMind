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

