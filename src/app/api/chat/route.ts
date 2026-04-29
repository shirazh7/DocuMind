import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { getModelCost, DEFAULT_MODEL_ID, MODELS } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { documentTools } from "@/lib/ai/tools";
import type { DocuMindMessage } from "@/lib/ai/types";

// ── WHY NODE.JS, NOT EDGE ──────────────────────────────────────────────
// The RAG pipeline uses fs.readFileSync to load markdown docs and needs
// full Node for embedding operations. Edge would give faster TTFB but
// can't run this workload. Knowing when NOT to use Edge matters.
export const runtime = "nodejs";
export const maxDuration = 30;

// PRODUCTION: Rate-limit per user/IP via Vercel WAF or middleware.
// PRODUCTION: Add Vercel OTEL for tracing latency, token usage, and tool calls.
// PRODUCTION: Enforce per-request token budget (maxOutputTokens: 4096) and
// monthly spend caps per org — alert or disable when approaching limits.

export async function POST(req: Request) {
  // ── FAIL FAST ── Return a clear error if the Gateway key is missing,
  // rather than failing cryptically deep in the embedding pipeline.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI_GATEWAY_API_KEY is not configured. Set it in your environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const {
    messages,
    modelId = DEFAULT_MODEL_ID,
  }: { messages: DocuMindMessage[]; modelId?: string } = await req.json();

  // PRODUCTION: Sanitize message content — strip HTML/script tags,
  // enforce max length, validate encoding before processing.

  const validModelId = modelId in MODELS ? modelId : DEFAULT_MODEL_ID;

  // ── CORE: streamText + tool calling ──────────────────────────────────
  // Model string goes through AI Gateway — no provider SDK needed.
  // convertToModelMessages is the v5 pattern for UI → model message format.
  // stepCountIs(3) enables multi-step tool use: retrieve → analyse →
  // retrieve again with a refined query. Higher risks runaway loops.
  const result = streamText({
    model: validModelId,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: documentTools,
    stopWhen: stepCountIs(3),
  });

  // ── WHY toUIMessageStreamResponse OVER toDataStreamResponse ──────────
  // UIMessage stream sends structured parts (text, tool calls, metadata)
  // that useChat renders incrementally. The messageMetadata callback lets
  // us attach cost data to each message — no separate API call needed.
  // At "start": send the model ID. At "finish": calculate cost from
  // token usage × per-model pricing and attach it to the message.
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return { modelId: validModelId };
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
