import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { getModelCost, DEFAULT_MODEL_ID, MODELS } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { documentTools } from "@/lib/ai/tools";
import type { DocuMindMessage } from "@/lib/ai/types";

// PRODUCTION: Rate limit this endpoint per user/IP using Vercel WAF or middleware.
// PRODUCTION: Add Vercel OTEL integration for tracing request latency, token usage,
// and tool call patterns. This data is critical for monitoring cost and quality.
// PRODUCTION: Enforce per-request token budget (e.g., maxOutputTokens: 4096) and
// track cumulative monthly spend per org. Alert or disable when approaching caps.
// PRODUCTION: Wrap streamText in a try/catch to handle LLM timeouts, context window
// overflow (HTTP 413/400), and provider outages. Return a structured error response
// with a user-friendly message and retry-after header.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  // PRODUCTION: API keys are kept server-side via env vars — never expose them
  // to the client bundle. Rotate keys regularly and scope them per environment.
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

  // PRODUCTION: Validate and sanitize message content before processing.
  // Strip HTML/script tags, enforce max message length, validate encoding.

  const validModelId = modelId in MODELS ? modelId : DEFAULT_MODEL_ID;

  // stepCountIs(3) allows up to 3 LLM round-trips: the model can retrieve,
  // analyze the results, and optionally retrieve again with a refined query.
  // Higher values risk runaway tool loops; lower values limit multi-hop reasoning.
  const result = streamText({
    model: validModelId,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: documentTools,
    stopWhen: stepCountIs(3),
  });

  // toUIMessageStreamResponse sends structured parts (text, tool calls, metadata)
  // that useChat can render incrementally. Chosen over toDataStreamResponse
  // because it supports messageMetadata for passing cost/usage data per message.
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
