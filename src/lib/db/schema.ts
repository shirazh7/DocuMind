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

