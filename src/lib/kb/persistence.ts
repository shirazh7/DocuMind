// ── USER DOCUMENT PERSISTENCE ───────────────────────────────────────────
//
// CRUD layer for the user_documents table in Neon. Each row tracks:
//   - Blob URL and mime type (where the file is stored)
//   - status lifecycle: pending → processing → ready | failed
//   - extracted_text: the server-side text extraction result (set by the
//     ingest Workflow; used as a Blob fallback in the KB detail page)
//   - error: populated on failure so the UI can surface a reason
//
// getUserDocumentForUser vs getUserDocumentById:
//   ForUser enforces ownership (WHERE user_id AND id) — used in delete
//   and auth paths where the caller must own the document.
//   ById is used internally by the ingest Workflow where user_id is not
//   in scope (the Workflow runs server-side with the document id only).
//   getUserDocumentBySlug is used for slug-based routing (KB detail page).

import { getDb } from "@/lib/db/client";
import { ensureDatabaseSchema } from "@/lib/db/schema";
import type { UploadStatus } from "@/lib/kb/types";

export interface UserDocumentRow {
  id: string;
  slug: string;
  user_id: string;
  filename: string;
  title: string;
  description: string | null;
  extracted_text: string | null;
  blob_url: string;
  mime_type: string;
  size_bytes: number;
  status: UploadStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewUserDocumentInput {
  id: string;
  slug: string;
  userId: string;
  filename: string;
  title: string;
  description?: string | null;
  blobUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export async function createUserDocument(input: NewUserDocumentInput) {
  await ensureDatabaseSchema();
  const sql = getDb();

  await sql`
    INSERT INTO user_documents (
      id, slug, user_id, filename, title, description, extracted_text, blob_url, mime_type, size_bytes, status
    )
    VALUES (
      ${input.id},
      ${input.slug},
      ${input.userId},
      ${input.filename},
      ${input.title},
      ${input.description ?? null},
      null,
      ${input.blobUrl},
      ${input.mimeType},
      ${input.sizeBytes},
      'pending'
    )
  `;
}

export async function listUserDocuments(userId: string) {
  await ensureDatabaseSchema();
  const sql = getDb();
  return (await sql`
    SELECT
      id, slug, user_id, filename, title, description, extracted_text, blob_url, mime_type,
      size_bytes, status, error, created_at::text, updated_at::text
    FROM user_documents
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `) as UserDocumentRow[];
}

export async function getUserDocumentById(id: string) {
  await ensureDatabaseSchema();
  const sql = getDb();
  const rows = (await sql`
    SELECT
      id, slug, user_id, filename, title, description, extracted_text, blob_url, mime_type,
      size_bytes, status, error, created_at::text, updated_at::text
    FROM user_documents
    WHERE id = ${id}
    LIMIT 1
  `) as UserDocumentRow[];
  return rows[0] ?? null;
}

export async function getUserDocumentBySlug(userId: string, slug: string) {
  await ensureDatabaseSchema();
  const sql = getDb();
  const rows = (await sql`
    SELECT
      id, slug, user_id, filename, title, description, extracted_text, blob_url, mime_type,
      size_bytes, status, error, created_at::text, updated_at::text
    FROM user_documents
    WHERE user_id = ${userId} AND slug = ${slug}
    LIMIT 1
  `) as UserDocumentRow[];
  return rows[0] ?? null;
}

export async function getUserDocumentForUser(userId: string, id: string) {
  await ensureDatabaseSchema();
  const sql = getDb();
  const rows = (await sql`
    SELECT
      id, slug, user_id, filename, title, description, extracted_text, blob_url, mime_type,
      size_bytes, status, error, created_at::text, updated_at::text
    FROM user_documents
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1
  `) as UserDocumentRow[];
  return rows[0] ?? null;
}

export async function updateUserDocumentStatus(
  id: string,
  status: UploadStatus,
  error: string | null = null
) {
  await ensureDatabaseSchema();
  const sql = getDb();
  await sql`
    UPDATE user_documents
    SET status = ${status}, error = ${error}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function updateUserDocumentExtractedText(id: string, text: string) {
  await ensureDatabaseSchema();
  const sql = getDb();
  await sql`
    UPDATE user_documents
    SET extracted_text = ${text}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteUserDocument(userId: string, id: string) {
  await ensureDatabaseSchema();
  const sql = getDb();
  const rows = (await sql`
    DELETE FROM user_documents
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, slug, user_id, filename, title, description, blob_url, mime_type,
      extracted_text, size_bytes, status, error, created_at::text, updated_at::text
  `) as UserDocumentRow[];
  return rows[0] ?? null;
}

