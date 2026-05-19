import type { ChunkMetadata } from "./chunker";
import { loadDocuments } from "./documents";
import { chunkDocuments } from "./chunker";
import { EMBEDDING_MODEL, generateChunkEmbeddings } from "./embeddings";
import { ensureDatabaseSchema } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";

export interface StoredChunk {
  text: string;
  embedding?: number[];
  metadata: ChunkMetadata;
}

interface SearchChunkRow {
  content: string;
  title: string;
  section: string;
  source: string;
  chunk_index: number;
  similarity: number;
}

let initPromise: Promise<void> | null = null;

function toPgVector(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function syncPersistentStore(options?: { force?: boolean }) {
  await ensureDatabaseSchema();
  const sql = getDb();
  const force = options?.force ?? false;

  if (force) {
    await sql`DELETE FROM rag_chunks WHERE embedding_model = ${EMBEDDING_MODEL}`;
  } else {
    const existing = (await sql`
      SELECT COUNT(*)::text AS count
      FROM rag_chunks
      WHERE embedding_model = ${EMBEDDING_MODEL}
    `) as { count: string }[];

    if (Number(existing[0]?.count ?? "0") > 0) {
      return;
    }
  }

  const documents = loadDocuments();
  const chunks = chunkDocuments(documents);
  const embeddedChunks = await generateChunkEmbeddings(chunks);

  for (const { chunk, embedding } of embeddedChunks) {
    await sql`
      INSERT INTO rag_chunks (
        source,
        title,
        section,
        chunk_index,
        content,
        embedding,
        embedding_model,
        updated_at
      )
      VALUES (
        ${chunk.metadata.source},
        ${chunk.metadata.title},
        ${chunk.metadata.section},
        ${chunk.metadata.chunkIndex},
        ${chunk.text},
        ${toPgVector(embedding)}::vector,
        ${EMBEDDING_MODEL},
        NOW()
      )
      ON CONFLICT (source, chunk_index, embedding_model)
      DO UPDATE SET
        title = EXCLUDED.title,
        section = EXCLUDED.section,
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    `;
  }

  console.log(
    `[DocuMind] Persistent vector store synced with ${embeddedChunks.length} chunks`
  );
}

export async function ensurePersistentStoreReady() {
  if (!initPromise) {
    initPromise = syncPersistentStore().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

export async function searchSimilarChunks(
  queryEmbedding: number[],
  topK: number
): Promise<{ text: string; metadata: ChunkMetadata; similarity: number }[]> {
  await ensurePersistentStoreReady();
  const sql = getDb();

  const rows = (await sql`
    SELECT
      content,
      title,
      section,
      source,
      chunk_index,
      1 - (embedding <=> ${toPgVector(queryEmbedding)}::vector) AS similarity
    FROM rag_chunks
    WHERE embedding_model = ${EMBEDDING_MODEL}
    ORDER BY embedding <=> ${toPgVector(queryEmbedding)}::vector
    LIMIT ${topK}
  `) as SearchChunkRow[];

  return rows.map((row) => ({
    text: row.content,
    metadata: {
      title: row.title,
      section: row.section,
      source: row.source,
      chunkIndex: row.chunk_index,
    },
    similarity: row.similarity,
  }));
}

export async function getStore(): Promise<StoredChunk[]> {
  await ensurePersistentStoreReady();
  const sql = getDb();

  const rows = (await sql`
    SELECT content, title, section, source, chunk_index
    FROM rag_chunks
    WHERE embedding_model = ${EMBEDDING_MODEL}
    ORDER BY source ASC, chunk_index ASC
  `) as {
    content: string;
    title: string;
    section: string;
    source: string;
    chunk_index: number;
  }[];

  return rows.map((row) => ({
    text: row.content,
    metadata: {
      title: row.title,
      section: row.section,
      source: row.source,
      chunkIndex: row.chunk_index,
    },
  }));
}
