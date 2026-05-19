import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { getModelCost, DEFAULT_MODEL_ID, MODELS } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { documentTools } from "@/lib/ai/tools";
import type { DocuMindMessage } from "@/lib/ai/types";
import { getCurrentUserId } from "@/lib/auth/user-id";
import {
  ensureChatSession,
  replaceChatMessages,
} from "@/lib/chat/persistence";
import { enforceChatRateLimit } from "@/lib/rate-limit/chat";
import { randomUUID } from "crypto";

// ── WHY NODE.JS, NOT EDGE ──────────────────────────────────────────────
// The RAG pipeline uses fs.readFileSync to load markdown docs and needs
// full Node for embedding operations. Edge would give faster TTFB but
// can't run this workload. Knowing when NOT to use Edge matters.
export const runtime = "nodejs";

// 30s covers: DB round-trip (ensureChatSession) + rate limit check +
// embedding the query + pgvector search + LLM streaming (TTFT ~1–3s,
// full response ~5–20s). Increase to 60s if using a slower model or if
// multi-step tool use regularly hits the limit in production.
export const maxDuration = 30;

// PRODUCTION: Add Vercel OTEL for tracing latency, token usage, and tool calls.
// PRODUCTION: Enforce per-request token budget and monthly spend caps per org.

export async function POST(req: Request) {
  // ── FAIL FAST ── Return a clear error if Gateway auth is missing.
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return new Response(
      JSON.stringify({
        error:
          "AI Gateway auth is not configured. Set AI_GATEWAY_API_KEY or pull VERCEL_OIDC_TOKEN.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!process.env.DATABASE_URL) {
    return new Response(
      JSON.stringify({
        error:
          "DATABASE_URL is not configured. Install Neon via Vercel Marketplace and pull environment variables.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const {
    messages,
    modelId = DEFAULT_MODEL_ID,
    sessionId,
  }: { messages: DocuMindMessage[]; modelId?: string; sessionId?: string } =
    await req.json();

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "sessionId is required for chat persistence." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const userId = await getCurrentUserId();

  // Upsert the session before rate limiting so the session row exists even
  // if the request is later rejected. This avoids a race where the client
  // creates a session (POST /api/chat/sessions) but the first chat request
  // gets rate-limited before ensureChatSession runs, leaving the session
  // with no owner in a subsequent retry. The upsert is idempotent and cheap.
  await ensureChatSession(sessionId, userId);

  const rateLimit = await enforceChatRateLimit(userId);
  if (!rateLimit.success) {
    return new Response(
      JSON.stringify({
        error: rateLimit.reason,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset: rateLimit.reset,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...(rateLimit.limit != null ? { "X-RateLimit-Limit": String(rateLimit.limit) } : {}),
          ...(rateLimit.remaining != null
            ? { "X-RateLimit-Remaining": String(rateLimit.remaining) }
            : {}),
        },
      }
    );
  }

  // PRODUCTION: Sanitize message content — strip HTML/script tags,
  // enforce max length, validate encoding before processing.

  const validModelId = modelId in MODELS ? modelId : DEFAULT_MODEL_ID;
  const requestId = randomUUID();

  // ── CORE: streamText + tool calling ──────────────────────────────────
  // Model string goes through AI Gateway — no provider SDK needed.
  // convertToModelMessages maps UI messages to model messages safely.
  // stepCountIs(3) enables multi-step tool use: retrieve → analyse →
  // retrieve again with a refined query. Higher risks runaway loops.
  const result = streamText({
    model: validModelId,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: documentTools,
    stopWhen: stepCountIs(3),
    providerOptions: {
      gateway: {
        user: userId,
        tags: ["feature:chat", "app:documind"],
      },
    },
  });

  // ── WHY toUIMessageStreamResponse OVER toDataStreamResponse ──────────
  // UIMessage stream sends structured parts (text, tool calls, metadata)
  // that useChat renders incrementally. The messageMetadata callback lets
  // us attach cost data to each message — no separate API call needed.
  // At "start": send the model ID. At "finish": calculate cost from
  // token usage × per-model pricing and attach it to the message.
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: completeMessages }) => {
      await replaceChatMessages(sessionId, completeMessages as DocuMindMessage[]);
    },
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return { modelId: validModelId, sessionId, requestId };
      }
      if (part.type === "finish") {
        const cost = getModelCost(validModelId);
        const estimatedCost =
          (part.totalUsage.inputTokens ?? 0) * cost.inputPerToken +
          (part.totalUsage.outputTokens ?? 0) * cost.outputPerToken;
        return {
          totalUsage: part.totalUsage,
          estimatedCost,
        };
      }
    },
  });
}
