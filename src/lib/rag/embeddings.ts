import { embed, embedMany } from "ai";
import { TextChunk } from "./chunker";

// ── EMBEDDING: text-embedding-3-small VIA AI GATEWAY ───────────────────
//
// Why text-embedding-3-small over text-embedding-3-large: 6x cheaper with
// only marginal accuracy loss for short-form internal docs. 1536 dimensions
// is sufficient for cosine similarity over a small corpus. Upgrading to
// 3-large matters more with 100k+ chunks where recall becomes critical.
//
// embedMany batches in groups of 100 (OpenAI's limit per request).
// embed handles single queries for real-time retrieval.
//
// PRODUCTION: Cache embeddings in Vercel KV or a managed vector DB to
// avoid re-computing on every cold start.
// PRODUCTION: Pin the embedding model version — if the model changes,
// all stored embeddings must be regenerated for consistency.

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: batch,
      providerOptions: {
        gateway: {
          user: "system:indexer",
          tags: ["feature:rag-ingest", "app:documind"],
        },
      },
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  // PRODUCTION: Sanitize query — strip HTML, limit length, validate encoding.
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: query,
    providerOptions: {
      gateway: {
        user: "system:retriever",
        tags: ["feature:rag-retrieval", "app:documind"],
      },
    },
  });
  return embedding;
}

export async function generateChunkEmbeddings(
  chunks: TextChunk[]
): Promise<{ chunk: TextChunk; embedding: number[] }[]> {
  const texts = chunks.map((c) => c.text);
  const embeddings = await embedTexts(texts);

  return chunks.map((chunk, i) => ({
    chunk,
    embedding: embeddings[i],
  }));
}
