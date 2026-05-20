import { streamText, convertToModelMessages, stepCountIs, smoothStream, consumeStream } from "ai";
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
// The RAG pipeline queries Neon pgvector and runs embedding operations via
// the AI Gateway — both require full Node.js. Edge would give faster TTFB
// but can't run pg or crypto. Knowing when NOT to use Edge matters.
export const runtime = "nodejs";

// 60s covers: DB round-trip + rate limit + embedding + pgvector search +
// LLM streaming including Claude Sonnet with extended thinking (TTFT can
// reach 10–15s during the reasoning phase before text starts). GPT models
// finish well within 30s, but 60s gives Claude the headroom it needs
// without failing the request. Vercel's default is 10s; always set this
// explicitly for any route that does LLM work.
export const maxDuration = 60;

// TODO(production): Add Vercel OTEL for tracing latency, token usage, and tool calls.
// TODO(production): Enforce per-request token budget and monthly spend caps per org.

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

  // TODO(production): Sanitize message content — strip HTML/script tags,
  // enforce max length, validate encoding before processing.

  const validModelId = modelId in MODELS ? modelId : DEFAULT_MODEL_ID;
  const modelConfig = MODELS[validModelId];
  const requestId = randomUUID();

  // Captured here so durationMs in the 'finish' metadata part reflects the
  // full time from request receipt to stream completion — including DB round
  // trips, rate-limit check, embedding, pgvector search, and LLM streaming.
  const startTime = Date.now();

  // ── CORE: streamText + tool calling ──────────────────────────────────
  // Model string goes through AI Gateway — no provider SDK needed.
  // convertToModelMessages maps UI messages to model messages safely.
  //
  // stepCountIs(5): reasoning models like Claude Sonnet naturally perform
  // multi-step retrieval — they retrieve, evaluate the results, then refine
  // and retrieve again before answering. With stepCountIs(3), two retrieval
  // steps consumed all available steps before the answer could generate.
  // 5 steps accommodates: retrieve → refine+retrieve → answer+suggestFollowUps
  // → (optional) suggestFollowUps result processing. Still bounded to prevent
  // runaway loops; GPT models typically finish in 2–3 steps.
  //
  // smoothStream: buffers raw token chunks and re-emits them word-by-word
  // with a small delay. Without this, models like Claude emit large batches
  // that cause choppy/stuttering UI updates. GPT models benefit too.
  //
  // anthropic.thinking: required to activate Claude's extended-thinking mode.
  // sendReasoning: true (on toUIMessageStreamResponse) only *forwards* tokens
  // that already exist — the model won't produce any reasoning unless this
  // providerOption explicitly enables it. budgetTokens: 8000 is enough for
  // complex RAG queries without excessive cost or latency.
  // Per the AI Gateway docs, providerOptions.anthropic is forwarded to the
  // underlying Anthropic API alongside providerOptions.gateway routing options.
  const result = streamText({
    model: validModelId,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: documentTools,
    stopWhen: stepCountIs(5),
    experimental_transform: smoothStream({ delayInMs: 20, chunking: "word" }),
    // Forward the request abort signal so the LLM call is cancelled if the
    // client disconnects mid-stream. Without this, the model continues
    // generating and burning AI Gateway tokens after the user navigates away
    // or the browser tab is closed.
    abortSignal: req.signal,
    providerOptions: {
      gateway: {
        user: userId,
        tags: ["feature:chat", "app:documind"],
      },
      ...(modelConfig?.supportsThinking
        ? {
            anthropic: {
              thinking: { type: "enabled", budgetTokens: 8000 },
            },
          }
        : {}),
    },
  });

  // ── WHY toUIMessageStreamResponse OVER toDataStreamResponse ──────────
  // UIMessage stream sends structured parts (text, tool calls, metadata)
  // that useChat renders incrementally. The messageMetadata callback lets
  // us attach cost and timing data to each message — no separate API call.
  //
  // sendReasoning: true forwards reasoning tokens (e.g. from claude-sonnet-4-5
  // or deepseek-r1) to the client as part.type === 'reasoning' parts. This is
  // a no-op for models that don't emit reasoning tokens, so it is safe to
  // enable globally — the UI renders the reasoning block only when present.
  //
  // At "start": send the model ID, session ID, request ID, and createdAt
  // timestamp (drives the "HH:MM AM/PM" display in the message footer).
  // At "finish": calculate cost, attach token usage, and compute durationMs
  // (Date.now() - startTime) which drives the "Worked for Xs" footer display.
  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    originalMessages: messages,
    // consumeSseStream is required for correct abort handling in UI message
    // streams. It ensures the SSE stream is properly consumed and torn down
    // when the client disconnects (works in tandem with abortSignal above).
    consumeSseStream: consumeStream,
    onFinish: async ({ messages: completeMessages }) => {
      // completeMessages is UIMessage[] — the metadata generic doesn't affect
      // the message structure that gets persisted (content, role, parts only).
      // The cast is safe: persistence only reads parts and role, never metadata.
      await replaceChatMessages(sessionId, completeMessages as DocuMindMessage[]);
    },
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return { modelId: validModelId, sessionId, requestId, createdAt: Date.now() };
      }
      if (part.type === "finish") {
        const cost = getModelCost(validModelId);
        const estimatedCost =
          (part.totalUsage.inputTokens ?? 0) * cost.inputPerToken +
          (part.totalUsage.outputTokens ?? 0) * cost.outputPerToken;
        return {
          totalUsage: part.totalUsage,
          estimatedCost,
          durationMs: Date.now() - startTime,
        };
      }
    },
  });
}
