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

