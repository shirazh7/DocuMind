import { embed, embedMany } from "ai";
import { TextChunk } from "./chunker";

// PRODUCTION: Cache embeddings in Vercel KV or a managed vector DB (Pinecone, Weaviate)
// to avoid re-computing on every cold start. For this demo, we use an in-memory cache
// that's populated on first request.

// PRODUCTION: Pin the embedding model version. If the model changes, all stored embeddings
// must be regenerated to maintain consistency.

// Vercel AI Gateway: plain string model reference — gateway routes to OpenAI automatically
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: batch,
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  // PRODUCTION: Sanitize query input before embedding — strip HTML tags,
  // limit length to prevent token overflow, validate encoding.
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: query,
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
