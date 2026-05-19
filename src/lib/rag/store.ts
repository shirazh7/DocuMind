// ── PERSISTENT VECTOR STORE: NEON + PGVECTOR ───────────────────────────
//
// Replaces the original in-memory store that re-embedded all documents on
// every cold start, burning AI Gateway tokens and adding 2–3s to the first
// request of each new serverless instance.
//
// Design decisions:
//
// Idempotent sync: syncPersistentStore counts existing rows for the current
// EMBEDDING_MODEL before doing any work. If rows exist it returns immediately,
// so cold starts are instant after the first ingest. `force: true` clears only
// rows for the current model, which safely handles model upgrades without
// deleting data for other models.
//
// Upsert over insert: ON CONFLICT (source, chunk_index, embedding_model)
// DO UPDATE lets incremental ingest update changed chunks without needing
// to track document hashes. The triple composite key means the same source
// can be re-chunked with a new model without touching existing model's rows.
//
// Per-chunk INSERTs in a loop: pgvector doesn't support multi-row vector
// inserts efficiently in all drivers. Serial inserts are slower than a bulk
// COPY but simple, auditable, and safe to run inside the ingest Workflow
// step which has automatic retry. For corpora >10k chunks, switch to
// batched unnest() or pg_bulkload.
//
// pgvector wire format: the driver doesn't auto-cast JS arrays to vector.
// toPgVector produces "[1,2,3]" then appends ::vector in the query — this
// is the standard string literal syntax pgvector accepts over HTTP.
//
// Distance vs similarity: pgvector's <=> is cosine distance (1 - cosine_sim).
// We ORDER BY distance (ascending = most similar first) and return
// 1 - distance as the similarity score so downstream code sees [0, 1].
//
// initPromise deduplicates concurrent calls on the same serverless instance
// (e.g. two requests hitting a cold start simultaneously). On error the
// promise is cleared so the next request retries rather than caching failure.
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

// pgvector expects the string literal format "[1.0,2.0,...]" via the HTTP driver.
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
