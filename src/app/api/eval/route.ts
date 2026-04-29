import { generateText, stepCountIs } from "ai";
import { DEFAULT_MODEL_ID, MODELS } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { documentTools } from "@/lib/ai/tools";

// ── EVAL API: ONE TEST CASE PER REQUEST ────────────────────────────────
//
// Uses generateText (blocking), NOT streamText. Evaluation needs the
// complete response to run grounding checks — streaming would require
// buffering the full output anyway. Each test case hits this endpoint
// individually so the client can show incremental progress.
//
// Extracts sources from tool results in steps to include them in the
// eval output alongside the answer text and latency.
//
// PRODUCTION: Behind authentication only — each run costs API credits.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { answer: "", sources: [], latency: 0, error: "AI_GATEWAY_API_KEY is not configured. Set it in your environment variables." },
      { status: 500 }
    );
  }

  const { question, modelId = DEFAULT_MODEL_ID } = await req.json();

  const startTime = Date.now();
  const validModelId = modelId in MODELS ? modelId : DEFAULT_MODEL_ID;

  try {
    // generateText (blocking) is used instead of streamText because evaluation
    // needs the complete response to run grounding checks — streaming would
    // require buffering the full output anyway. Each test case hits this
    // endpoint individually so the client can show incremental progress.
    const { text, steps } = await generateText({
      model: validModelId,
      system: SYSTEM_PROMPT,
      prompt: question,
      tools: documentTools,
      stopWhen: stepCountIs(3),
    });

    const latency = Date.now() - startTime;

    const sources: Array<{
      index: number;
      source: string;
      section: string;
      content: string;
      similarity: number;
    }> = [];

    for (const step of steps) {
      if (step.toolResults) {
        for (const result of step.toolResults) {
          if (
            result.toolName === "retrieveDocuments" &&
            result.output &&
            typeof result.output === "object" &&
            "results" in result.output
          ) {
            const output = result.output as {
              results: typeof sources;
              avgSimilarity: number;
            };
            sources.push(...output.results);
          }
        }
      }
    }

    return Response.json({
      answer: text,
      sources,
      latency,
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    return Response.json(
      {
        answer: "",
        sources: [],
        latency,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
