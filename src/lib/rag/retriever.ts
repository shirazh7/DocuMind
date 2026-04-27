import { cosineSimilarity } from "ai";
import { embedQuery } from "./embeddings";
import { getStore } from "./store";
import { ChunkMetadata } from "./chunker";

// PRODUCTION: Implement hybrid search combining vector similarity with BM25 keyword
// matching for better recall. Add query rewriting to expand abbreviations and fix typos.
// Consider adding a reranking step (e.g., Cohere Rerank) after initial retrieval.

export interface RetrievedChunk {
  text: string;
  metadata: ChunkMetadata;
  similarity: number;
}

export async function retrieveRelevantChunks(
  query: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  const [queryEmbedding, store] = await Promise.all([
    embedQuery(query),
    getStore(),
  ]);

  const scored = store.map((chunk) => ({
    text: chunk.text,
    metadata: chunk.metadata,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topK);
}
