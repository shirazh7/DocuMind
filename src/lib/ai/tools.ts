import { tool } from "ai";
import { z } from "zod";
import { retrieveRelevantChunks } from "@/lib/rag/retriever";

// ── WHY TOOL CALLING, NOT CONTEXT INJECTION ────────────────────────────
// 1. The model decides WHEN to retrieve. If the user says "hello" or
//    "thanks", there's no point running a vector search.
// 2. With stepCountIs(3), the model can do multi-step reasoning:
//    retrieve → read results → retrieve again with a refined query.
//    That's the agentic pattern — the model drives its own info gathering.
// 3. Demonstrates the AI SDK tool calling pattern that enterprise
//    customers will use for more complex agentic workflows.
//
// Trade-off: adds one round-trip of latency vs direct context injection.
// For a high-volume system where every query definitely needs retrieval,
// you might pre-fetch. But for an assistant where some queries are
// conversational, tool calling is the right pattern.
//
// PRODUCTION: Add tools for filtering by doc type, date range, or team.
// PRODUCTION: Log every tool invocation (query, result count, latency)
// via OTEL spans for retrieval quality debugging.

export const documentTools = {
  retrieveDocuments: tool({
    description:
      "Search the internal knowledge base for relevant documentation. Call this tool when the user asks a question that requires information from company docs.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The search query to find relevant documentation"),
    }),
    // Returns top 5 chunks with source title, section, text, and similarity
    // score. avgSimilarity feeds the confidence badge in the UI.
    execute: async ({ query }) => {
      const chunks = await retrieveRelevantChunks(query, 5);
      return {
        results: chunks.map((chunk, i) => ({
          index: i + 1,
          source: chunk.metadata.title,
          section: chunk.metadata.section,
          content: chunk.text,
          similarity: chunk.similarity,
        })),
        avgSimilarity:
          chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length,
      };
    },
  }),
};
