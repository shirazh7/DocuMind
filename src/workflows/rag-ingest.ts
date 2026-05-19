// ── RAG INGEST WORKFLOW ─────────────────────────────────────────────────
//
// Durable wrapper around the knowledge base embedding pipeline.
// Triggered manually on first deployment, or whenever documents change.
//
// Why a Workflow instead of a plain API route:
// Embedding ~N chunks via the AI Gateway can take 30–120s depending on
// corpus size — well beyond the default serverless function timeout.
// Workflow steps execute with automatic retries and durable checkpointing,
// so a transient Gateway timeout or Neon hiccup doesn't restart from scratch.
//
// Why all logic lives in a "use step" function:
// "use workflow" functions run in a sandboxed VM without Node.js APIs.
// The ingest pipeline uses fs (for document loading) and crypto — these
// need full Node access, which "use step" provides.
//
// force = false by default: syncPersistentStore skips embedding if rows
// already exist, making this safe to re-trigger without re-embedding.
// Pass { force: true } via the API route body for an explicit re-embed.
import { ingestKnowledgeBase } from "@/lib/rag/ingest";

async function runIngestionStep(force: boolean) {
  "use step";
  return ingestKnowledgeBase({ force });
}

export async function ragIngestWorkflow(force = false) {
  "use workflow";

  await runIngestionStep(force);

  return {
    ok: true,
    force,
    completedAt: new Date().toISOString(),
  };
}

