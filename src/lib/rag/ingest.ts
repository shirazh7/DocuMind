// ── RAG INGEST: BRIDGE BETWEEN WORKFLOW LAYER AND VECTOR STORE ─────────
//
// Two entry points reflect two different ingest paths:
//
// ingestKnowledgeBase — full sync of all static KNOWLEDGE_BASE_DOCS into
//   Neon pgvector. Called by ragIngestWorkflow (initial seed) and
//   ragReindexWorkflow (periodic refresh via cron). force=false is the
//   default: existing chunks are upserted and unchanged docs are skipped.
//
// ingestUploadedDocument — single-document incremental ingest for user
//   uploads. Fetches the file from Vercel Blob, extracts text (using unpdf
//   for PDFs, mammoth for DOCX, raw UTF-8 for .md/.txt), persists
//   extracted_text to Neon, then calls syncUploadedDocument to embed and
//   index the chunks. Called by docIngestWorkflow after upload. Kept
//   separate from the bulk path so user uploads don't trigger a full
//   reindex on every file addition.

import { syncPersistentStore, syncUploadedDocument } from "@/lib/rag/store";
import {
  getUserDocumentById,
  updateUserDocumentExtractedText,
  updateUserDocumentStatus,
} from "@/lib/kb/persistence";
import { extractDocumentText } from "@/lib/kb/extract-text";

/**
 * Triggers a full sync of all static KNOWLEDGE_BASE_DOCS into Neon pgvector.
 * Pass `{ force: true }` to force re-embedding (e.g. after an embedding model
 * change). Without `force`, existing chunks are reused and unchanged docs are
 * skipped.
 */
export async function ingestKnowledgeBase(options?: { force?: boolean }) {
  await syncPersistentStore({ force: options?.force ?? false });
  return { ok: true };
}

/**
 * Fetches a user-uploaded document from Vercel Blob, extracts its text
 * (unpdf for PDFs, mammoth for DOCX, raw UTF-8 for .md/.txt), persists
 * the extracted text to Neon, then embeds and indexes the chunks.
 *
 * Updates status to "ready" on success or "failed" with a human-readable
 * error message on failure. Throws so the calling Workflow step can retry.
 */
export async function ingestUploadedDocument(documentId: string) {
  const doc = await getUserDocumentById(documentId);
  if (!doc) {
    throw new Error("Uploaded document not found.");
  }

  await updateUserDocumentStatus(documentId, "processing", null);

  try {
    const response = await fetch(doc.blob_url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch uploaded file (${response.status}).`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const content = await extractDocumentText({
      filename: doc.filename,
      mimeType: doc.mime_type,
      buffer: bytes,
    });
    const normalized = content.trim();
    if (!normalized) {
      throw new Error("No extractable text found in document.");
    }
    await updateUserDocumentExtractedText(documentId, normalized);

    await syncUploadedDocument({
      documentId,
      filename: doc.filename,
      title: doc.title,
      content: normalized,
    });

    await updateUserDocumentStatus(documentId, "ready", null);
    return { ok: true, documentId };
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Unknown ingest failure.";
    const message = rawMessage.includes("PasswordException")
      ? "PDF is encrypted/password-protected and cannot be indexed."
      : rawMessage.includes("No extractable text found")
        ? "No extractable text found. For PDFs, ensure text is selectable (non-scanned)."
        : rawMessage;
    await updateUserDocumentStatus(documentId, "failed", message);
    throw error;
  }
}

