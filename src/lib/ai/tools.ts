import { tool } from "ai";
import { z } from "zod";
import { retrieveRelevantChunks } from "@/lib/rag/retriever";

// PRODUCTION: Validate tool inputs server-side even though Zod schemas handle
// parsing — an attacker could bypass the LLM and call the API directly. Add
// query length limits and strip injection patterns before hitting the vector store.
// PRODUCTION: Log every tool invocation (query, result count, latency) via OTEL
// spans for debugging retrieval quality and detecting abuse patterns.

// Tool calling is used instead of injecting all context into the system prompt
// so the model can decide *when* retrieval is needed and formulate targeted
// queries. This enables multi-step reasoning: retrieve → analyze gaps →
// retrieve again with a refined query — matching real-world agent patterns.
// A single tool keeps the interface simple; in production you'd add tools
// for filtering by doc type, date range, or team ownership.
export const documentTools = {
  retrieveDocuments: tool({
    description:
      "Search the internal knowledge base for relevant documentation. Call this tool when the user asks a question that requires information from company docs.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The search query to find relevant documentation"),
    }),
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
