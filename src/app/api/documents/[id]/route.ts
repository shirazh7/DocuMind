// ── DOCUMENT DELETE ─────────────────────────────────────────────────────
//
// Deletes a user-uploaded document in three steps:
//   1. Remove the file from Vercel Blob.
//   2. Delete all rag_chunks rows whose source starts with "user-doc:<id>"
//      so the document is no longer retrievable in RAG queries.
//   3. Delete the user_documents row (cascades to any remaining refs).
//
// Static documents (slug prefixed "static:") are protected and cannot be
// deleted — they are bundled with the application as its base knowledge base
// and are not stored in Blob or user_documents.
//
// Deletion is done inline rather than via a Workflow because it is fast,
// reversible (re-upload), and does not need the retry/durability guarantees
// that ingest requires.

import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getCurrentUserId } from "@/lib/auth/user-id";
import {
  deleteUserDocument,
  getUserDocumentForUser,
} from "@/lib/kb/persistence";
import { getDb } from "@/lib/db/client";
import { ensureDatabaseSchema } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (id.startsWith("static:")) {
      return NextResponse.json(
        { error: "Demo knowledge base documents are protected and cannot be deleted." },
        { status: 403 }
      );
    }
    const userId = await getCurrentUserId();

    const doc = await getUserDocumentForUser(userId, id);
    if (!doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    await del(doc.blob_url).catch(() => null);
    await ensureDatabaseSchema();
    const sql = getDb();
    await sql`DELETE FROM rag_chunks WHERE source = ${`user-doc:${id}`}`;
    await deleteUserDocument(userId, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DocuMind] Failed to delete uploaded document", error);
    return NextResponse.json(
      { error: "Unable to delete document." },
      { status: 500 }
    );
  }
}

