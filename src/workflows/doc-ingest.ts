// ── USER DOCUMENT INGEST WORKFLOW ───────────────────────────────────────
//
// Durable ingest for a single uploaded document. Triggered by /api/documents
// right after the Blob upload + metadata insert succeeds.
//
// Why a workflow for one file:
// - Embedding calls can fail transiently (rate limit / network hiccups)
// - Durable retry keeps UX simple: upload returns quickly, indexing happens
//   asynchronously, and the document status updates from pending -> ready/failed.
import { ingestUploadedDocument } from "@/lib/rag/ingest";

async function ingestUploadedDocumentStep(documentId: string) {
  "use step";
  return ingestUploadedDocument(documentId);
}

export async function docIngestWorkflow(documentId: string) {
  "use workflow";

  await ingestUploadedDocumentStep(documentId);
  return {
    ok: true,
    documentId,
    completedAt: new Date().toISOString(),
  };
}

