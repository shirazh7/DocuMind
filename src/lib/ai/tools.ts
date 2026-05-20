import { tool } from "ai";
import { z } from "zod";
import { retrieveRelevantChunks } from "@/lib/rag/retriever";

// ── WHY TOOL CALLING, NOT CONTEXT INJECTION ────────────────────────────
// 1. The model decides WHEN to retrieve. If the user says "hello" or
//    "thanks", there's no point running a vector search.
// 2. With stepCountIs(N), the model can do multi-step reasoning:
//    retrieve → read results → retrieve again with a refined query.
//    That's the agentic pattern — the model drives its own info gathering.
//    (The chat route uses stepCountIs(5) to give reasoning models headroom;
//    the eval route uses stepCountIs(3) for faster, bounded test runs.)
// 3. Demonstrates the AI SDK tool calling pattern that enterprise
//    customers will use for more complex agentic workflows.
//
// Trade-off: adds one round-trip of latency vs direct context injection.
// For a high-volume system where every query definitely needs retrieval,
// you might pre-fetch. But for an assistant where some queries are
// conversational, tool calling is the right pattern.
//
// TODO(production): Add tools for filtering by doc type, date range, or team.
// TODO(production): Log every tool invocation (query, result count, latency)
// via OTEL spans for retrieval quality debugging.

// ── SOURCE QUALITY PIPELINE ────────────────────────────────────────────
//
// Raw pgvector results have two quality problems:
//
// 1. Duplicate sources: a large document (e.g. a multi-page PDF) may
//    produce many chunks that all rank in the top-5. The LLM receives
//    redundant context and the Sources panel shows the same document
//    multiple times. Fix: deduplicate by source+section composite key.
//    Keying on source alone failed in practice: a doc with multiple
//    relevant sections (e.g. "P1 — Critical" AND "P1 Escalation Timeline"
//    in incident-response.md) had all but the top chunk removed, causing
//    the model to receive partial information and decline to answer fully.
//    source::section allows distinct sections to coexist while still
//    deduplicating chunks that come from splitting one long section.
//
// 2. Low-relevance noise: pgvector always returns topK rows regardless
//    of how dissimilar they are. For off-topic queries this surfaces
//    irrelevant chunks with very low similarity scores. Fix: filter
//    below MIN_SIMILARITY before deduplication.
//
// Pipeline: over-fetch 15 candidates → threshold filter → dedup by source::section
// → take top 5 results. The LLM context stays focused and the Sources
// panel shows at most one card per unique document section.
//
// Why 0.25 as the threshold: conservative enough that on-topic queries
// never return zero results (typical relevant chunks score 0.4–0.8),
// but aggressive enough to remove clear noise (unrelated chunks often
// score < 0.2 for well-separated corpora).
const CANDIDATE_FETCH = 15;
const MIN_SIMILARITY = 0.25;
const MAX_SOURCES = 5;

export const documentTools = {
  // ── FOLLOW-UP SUGGESTIONS ─────────────────────────────────────────────
  // After the model formulates its answer, it calls this tool with 2-3 short
  // follow-up questions grounded in the retrieved content. The client extracts
  // these from the message parts (same pattern as retrieveDocuments results)
  // and renders them as clickable chips below the response.
  //
  // Why a tool rather than injecting into the text output: tool outputs are
  // structured, typed, and easy to extract client-side without parsing prose.
  // The model also calls it independently of the text generation, so it never
  // pollutes the displayed answer with suggestion boilerplate.
  //
  // execute is synchronous — the model supplies the questions directly and
  // the tool just passes them through. Zero latency overhead.
  suggestFollowUps: tool({
    description:
      "After answering a question, call this tool with 2-3 short follow-up questions the user might want to ask next. Questions must be specific to the retrieved documents and current answer — not generic.",
    inputSchema: z.object({
      questions: z
        .array(z.string())
        .min(1)
        .max(3)
        .describe(
          "2-3 short, specific follow-up questions grounded in the retrieved content"
        ),
    }),
    execute: async ({ questions }) => ({ questions }),
  }),

  retrieveDocuments: tool({
    description:
      "Search the internal knowledge base for relevant documentation. Call this tool when the user asks a question that requires information from company docs.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The search query to find relevant documentation"),
    }),
    execute: async ({ query }) => {
      // Over-fetch so there are enough candidates after filtering and
      // deduplication. Without this, a corpus where several chunks from
      // one document rank highly could leave fewer than MAX_SOURCES
      // unique results after dedup.
      const candidates = await retrieveRelevantChunks(query, CANDIDATE_FETCH);

      // Remove clearly irrelevant chunks before deduplication so that a
      // low-scoring chunk from a unique source doesn't displace a
      // higher-scoring chunk from a repeated source.
      const relevant = candidates.filter((c) => c.similarity >= MIN_SIMILARITY);

      // Deduplicate by source+section composite key, not source alone.
      // Keying on source only caused a critical retrieval failure: when a
      // single document (e.g. incident-response.md) contains multiple
      // relevant sections (e.g. "P1 — Critical" AND "P1 Escalation Timeline"),
      // only the highest-scoring chunk survived deduplication. The model
      // received partial information and correctly declined to answer.
      // Keying on source::section allows distinct sections from the same
      // document to coexist in results, while still deduplicating chunks
      // that come from splitting a single long section into multiple pieces.
      const seen = new Set<string>();
      const deduplicated = relevant.filter((c) => {
        const key = `${c.metadata.source}::${c.metadata.section}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const chunks = deduplicated.slice(0, MAX_SOURCES);

      // avgSimilarity feeds the confidence badge in the Sources panel header.
      const avgSimilarity =
        chunks.length > 0
          ? chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
          : 0;

      return {
        results: chunks.map((chunk, i) => ({
          index: i + 1,
          source: chunk.metadata.title,
          section: chunk.metadata.section,
          content: chunk.text,
          similarity: chunk.similarity,
        })),
        avgSimilarity,
      };
    },
  }),
};
