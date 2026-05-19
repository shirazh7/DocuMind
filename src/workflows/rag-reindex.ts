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

