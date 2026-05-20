// ── KB DOCUMENT LAYER: STATIC + USER UPLOADS ───────────────────────────
//
// Provides a unified view of the knowledge base regardless of document origin:
//   - Static docs: defined in KNOWLEDGE_BASE_DOCS (lib/constants.ts) and
//     served from the filesystem via loadDocumentBySlug.
//   - User uploads: metadata in Neon (user_documents); content fetched from
//     Vercel Blob or the extracted_text column as a fallback.
//
// listKnowledgeBaseDocuments merges both sources into a single KnowledgeBaseDocument[].
// loadKnowledgeBaseDocumentBySlug resolves the correct content path per source type.
// This abstraction means pages like KB detail and the RAG pipeline don't need
// to know whether a given slug is static or user-uploaded.

import { KNOWLEDGE_BASE_DOCS } from "@/lib/constants";
import { loadDocumentBySlug } from "@/lib/rag/documents";
import { getUserDocumentBySlug, listUserDocuments } from "@/lib/kb/persistence";
import type { KnowledgeBaseDocument } from "@/lib/kb/types";

function buildStaticDocuments(): KnowledgeBaseDocument[] {
  return KNOWLEDGE_BASE_DOCS.map((doc) => ({
    id: `static:${doc.slug}`,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    icon: doc.icon,
    source: `${doc.slug}.md`,
    sourceType: "static" as const,
    updatedAt: "2026-04-24T00:00:00.000Z",
    sizeBytes: null,
  }));
}

export async function listKnowledgeBaseDocuments(userId: string) {
  const staticDocs = buildStaticDocuments();
  const userDocs = await listUserDocuments(userId);

  const uploaded = userDocs.map<KnowledgeBaseDocument>((doc) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    description: doc.description ?? "User uploaded document.",
    icon: "file",
    source: doc.filename,
    sourceType: "upload",
    updatedAt: doc.updated_at,
    sizeBytes: doc.size_bytes,
    status: doc.status,
    error: doc.error,
  }));

  return [...staticDocs, ...uploaded];
}

export async function loadKnowledgeBaseDocumentBySlug(
  userId: string,
  slug: string
): Promise<{
  title: string;
  source: string;
  description: string;
  content: string;
  sourceType: "static" | "upload";
  updatedAt: string;
  sizeBytes: number | null;
  status?: "pending" | "processing" | "ready" | "failed";
} | null> {
  const staticDoc = loadDocumentBySlug(slug);
  if (staticDoc) {
    const meta = KNOWLEDGE_BASE_DOCS.find((d) => d.slug === slug);
    return {
      title: staticDoc.metadata.title,
      source: staticDoc.metadata.source,
      description: meta?.description ?? "Internal engineering documentation.",
      content: staticDoc.content,
      sourceType: "static",
      updatedAt: "2026-04-24T00:00:00.000Z",
      sizeBytes: Buffer.byteLength(staticDoc.content, "utf8"),
    };
  }

  const uploaded = await getUserDocumentBySlug(userId, slug);
  if (!uploaded) {
    return null;
  }

  let content = uploaded.extracted_text;
  if (!content) {
    const response = await fetch(uploaded.blob_url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch uploaded document content (${response.status})`
      );
    }
    content = await response.text();
  }

  if (!content) {
    content = "No text preview available for this document.";
  }

  return {
    title: uploaded.title,
    source: uploaded.filename,
    description: uploaded.description ?? "User uploaded document.",
    content,
    sourceType: "upload",
    updatedAt: uploaded.updated_at,
    sizeBytes: uploaded.size_bytes,
    status: uploaded.status,
  };
}

