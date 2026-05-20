// ── DOCUMENT UPLOAD (POST) & LIST (GET) ────────────────────────────────
//
// POST: accepts multipart/form-data, stores the file in Vercel Blob, writes
// metadata to Neon (user_documents), then fires docIngestWorkflow to extract
// text and embed+index the document asynchronously. Ingest is async because
// PDF/DOCX extraction + embedding can take several seconds — returning early
// and polling status gives a better UX than blocking the upload response.
//
// GET: merges static KNOWLEDGE_BASE_DOCS with user_documents from Neon so
// the KB page shows a unified list regardless of document origin.
//
// TODO(production): Enforce per-user storage quotas and content moderation before
// accepting uploads.

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { start } from "workflow/api";
import { randomUUID } from "crypto";
import { getCurrentUserId } from "@/lib/auth/user-id";
import { docIngestWorkflow } from "@/workflows/doc-ingest";
import { listKnowledgeBaseDocuments } from "@/lib/kb/documents";
import { createUserDocument } from "@/lib/kb/persistence";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["md", "txt", "pdf", "docx"]);

function sanitizeTitle(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "Untitled upload";
}

function slugify(input: string) {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return normalized || "document";
}

function extensionFromFilename(filename: string) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const documents = await listKnowledgeBaseDocuments(userId);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("[DocuMind] Failed to list documents", error);
    return NextResponse.json(
      { error: "Unable to load documents." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            "BLOB_READ_WRITE_TOKEN is not configured. Install Vercel Blob via Marketplace and pull env vars.",
        },
        { status: 500 }
      );
    }

    const userId = await getCurrentUserId();
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing upload file." },
        { status: 400 }
      );
    }

    const extension = extensionFromFilename(file.name);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Only .md, .txt, .pdf, and .docx files are supported." },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File must be between 1 byte and 10 MB." },
        { status: 400 }
      );
    }

    const documentId = randomUUID();
    const title = sanitizeTitle(file.name);
    const slug = `user-${slugify(title)}-${documentId.slice(0, 8)}`;
    const pathname = `documind-uploads/${userId}/${documentId}.${extension}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
    });

    await createUserDocument({
      id: documentId,
      slug,
      userId,
      filename: file.name,
      title,
      description: "User uploaded document.",
      blobUrl: blob.url,
      mimeType: file.type || "text/plain",
      sizeBytes: file.size,
    });

    await start(docIngestWorkflow, [documentId]);

    return NextResponse.json({
      ok: true,
      document: {
        id: documentId,
        slug,
        title,
        source: file.name,
        sourceType: "upload",
        status: "pending",
      },
    });
  } catch (error) {
    console.error("[DocuMind] Failed to upload document", error);
    return NextResponse.json(
      { error: "Unable to upload and index document." },
      { status: 500 }
    );
  }
}

