import { embedQuery } from "./embeddings";
import { searchSimilarChunks } from "./store";
import { ChunkMetadata } from "./chunker";

// ── RETRIEVAL: TOP-5 COSINE SIMILARITY, NO THRESHOLD ───────────────────
//
// Embeds the query with the same text-embedding-3-small model through AI
// Gateway, computes cosineSimilarity (from the AI SDK) against every
// stored chunk, sorts descending, returns the top 5.
//
// Why no minimum similarity threshold: filtering out low-similarity results
// risks returning nothing, which is a worse UX than returning something with
// a visible trust signal. The confidence badge (green/amber/red) communicates
// retrieval quality. The system prompt instructs the model to decline when
// context is insufficient. The user knows when to be cautious.
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
