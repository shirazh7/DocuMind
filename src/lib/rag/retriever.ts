import { embedQuery } from "./embeddings";
import { searchSimilarChunks } from "./store";
import { ChunkMetadata } from "./chunker";

// ── RETRIEVAL: TOP-5 COSINE SIMILARITY VIA PGVECTOR, NO THRESHOLD ──────
//
// Embeds the query with the same text-embedding-3-small model used at ingest
// time (critical — mismatched models produce meaningless similarity scores),
// then delegates to searchSimilarChunks which runs a single Postgres ORDER BY
// cosine distance query using pgvector's <=> operator. The HNSW index makes
// this sub-millisecond even at scale; without it, Postgres falls back to an
// exact sequential scan which still works but is slower.
//
// Why no minimum similarity threshold: filtering out low-similarity results
// risks returning nothing, which is a worse UX than returning something with
// a visible trust signal. The confidence badge (green/amber/red) communicates
// retrieval quality. The system prompt instructs the model to decline when
// context is insufficient. The user knows when to be cautious.
//
// Why topK = 5: enough context for multi-part answers without exceeding typical
// context window budgets or degrading answer focus. Increase for dense corpora.
//
// Cosine similarity is the right metric: OpenAI embeddings are normalised,
// so cosine and dot product are equivalent. Cosine is more intuitive to
// explain — 1.0 is identical, 0.0 is unrelated.
//
// PRODUCTION: Three additions for a real system:
// 1. Hybrid search — combine vector similarity with BM25 keyword matching
//    so terms like CLI commands or error codes that don't embed well are found.
// 2. Query rewriting — expand the user's question into better search terms.
// 3. Reranking — retrieve top 20, rerank to top 5 with a cross-encoder
//    (e.g., Cohere Rerank). Retrieval gets recall, reranking gets precision.

export interface RetrievedChunk {
  text: string;
  metadata: ChunkMetadata;
  similarity: number;
}

export async function retrieveRelevantChunks(
  query: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  return searchSimilarChunks(queryEmbedding, topK);
}
