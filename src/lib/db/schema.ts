// ── DATABASE SCHEMA: RUNTIME DDL, IDEMPOTENT ───────────────────────────
//
// Why runtime CREATE TABLE IF NOT EXISTS instead of migration files:
// This is a single-developer project with no existing schema state to manage.
// Runtime DDL is simpler to operate — no migration runner, no deployment
// dependency ordering. For a production multi-tenant system, replace this
// with Neon Migrations or Drizzle/Prisma migrate to get schema versioning,
// rollback, and audit history.
//
// Table design decisions:
//
// rag_chunks — vector(1536) is hardcoded for text-embedding-3-small.
// If you change embedding models you must drop all rows for the old model
// (handled by syncPersistentStore({ force: true })) and re-embed. Storing
// embedding_model as a column allows multiple models to coexist during a
// migration period. The UNIQUE (source, chunk_index, embedding_model)
// constraint makes upsert safe for re-ingest.
//
// chat_messages — UNIQUE (session_id, sort_order) supports the
// replace-all write pattern: DELETE + re-INSERT from position 0 means
// we never need to track message deltas and order is always deterministic.
// ON DELETE CASCADE means deleting a session also removes all its messages
// without a separate DELETE.
//
// HNSW index is in a try/catch because it requires pgvector 0.5+ and the
// pg_vector_operations extension. If it fails (e.g. Neon plan limits), the
// retrieval query still works via exact sequential scan — just slower at scale.
//
// user_documents — metadata for end-user uploads stored in Vercel Blob.
// We keep file bytes in Blob (cheap/object storage) and only operational
// metadata in Neon (querying, ownership, indexing status).
// status drives UI and workflow retries:
//   pending -> processing -> ready
//   pending/processing -> failed (with error text) on terminal ingest failure.
// slug is unique and used by /kb/[slug] routing.
// extracted_text stores the parsed text for binary formats (PDF/DOCX) so
// KB detail pages can render readable content without re-parsing on each view.
//
// schemaInitPromise deduplicates concurrent schema checks on the same
// serverless instance. On failure the promise is cleared so the next request
// retries, avoiding a stuck null-that-looks-initialised bug.
import { getDb } from "@/lib/db/client";

let schemaInitPromise: Promise<void> | null = null;

export async function ensureDatabaseSchema() {
  if (schemaInitPromise) {
    return schemaInitPromise;
  }

  schemaInitPromise = (async () => {
    const sql = getDb();

    await sql`CREATE EXTENSION IF NOT EXISTS vector`;

    await sql`
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id BIGSERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        section TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536) NOT NULL,
        embedding_model TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source, chunk_index, embedding_model)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        role TEXT NOT NULL,
        parts JSONB NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (session_id, sort_order)
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS chat_messages_session_order_idx
      ON chat_messages (session_id, sort_order)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS chat_sessions_user_updated_idx
      ON chat_sessions (user_id, updated_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_documents (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        extracted_text TEXT,
        blob_url TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      ALTER TABLE user_documents
      ADD COLUMN IF NOT EXISTS extracted_text TEXT
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS user_documents_user_updated_idx
      ON user_documents (user_id, updated_at DESC)
    `;

    try {
      await sql`
        CREATE INDEX IF NOT EXISTS rag_chunks_embedding_cosine_idx
        ON rag_chunks USING hnsw (embedding vector_cosine_ops)
      `;
    } catch (error) {
      console.warn(
        "[DocuMind] Could not create HNSW index. Retrieval still works; continuing without ANN index.",
        error
      );
    }
  })().catch((error) => {
    schemaInitPromise = null;
    throw error;
  });

  return schemaInitPromise;
}

