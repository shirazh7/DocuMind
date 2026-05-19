// ── RAG REINDEX WORKFLOW ────────────────────────────────────────────────
//
// Hard-resets the vector store by deleting all chunks for the current
// embedding model and re-embedding from scratch. This is distinct from
// ragIngestWorkflow (which skips embedding if rows exist) precisely because
// reindex is for cases where you *need* a fresh start:
//
// - Changing the embedding model (text-embedding-3-small → text-embedding-3-large).
//   Chunks embedded with different models are not comparable; mixed-model
//   similarity scores are meaningless.
// - Knowledge base documents have changed significantly and stale chunks
//   produce poor retrieval results.
// - A previous partial ingest left the store in an inconsistent state.
//
// Scheduled weekly (Sunday 4am UTC via vercel.json cron) as a safety net.
// The idempotent nature of ingest means running it on a clean store is a
// no-op in terms of result quality — it just re-confirms correctness.
import { ingestKnowledgeBase } from "@/lib/rag/ingest";

async function runFullReindexStep() {
  "use step";
  return ingestKnowledgeBase({ force: true });
}

export async function ragReindexWorkflow() {
  "use workflow";

  await runFullReindexStep();

  return {
    ok: true,
    mode: "full-reindex",
    completedAt: new Date().toISOString(),
  };
}

