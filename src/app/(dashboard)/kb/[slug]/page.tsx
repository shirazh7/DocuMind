// ── KB DETAIL PAGE (SERVER COMPONENT) ──────────────────────────────────
//
// Serves both static and user-uploaded documents via a unified slug.
// Static docs (KNOWLEDGE_BASE_DOCS) are read from the filesystem at
// request time — not bundled into the client, keeping the bundle small.
// User-uploaded docs are fetched from Vercel Blob (or from the
// extracted_text column in Neon if Blob retrieval is unavailable) via
// loadKnowledgeBaseDocumentBySlug in lib/kb/documents.ts.
//
// "Ask about this" links to /chat?q=...&new=1. The `new=1` param tells
// chat-interface.tsx to clear the persisted session and start fresh, so
// the user always lands on a clean conversation about this document rather
// than having the question appended to an unrelated existing session.
// The chat interface auto-sends the pre-filled query once the new session
// is hydrated — no manual submit required.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "@/lib/auth/user-id";
import { loadKnowledgeBaseDocumentBySlug } from "@/lib/kb/documents";
import { DocViewer } from "@/components/kb/doc-viewer";

interface KBDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function KBDetailPage({ params }: KBDetailPageProps) {
  const { slug } = await params;
  const userId = await getCurrentUserId();
  const doc = await loadKnowledgeBaseDocumentBySlug(userId, slug);

  if (!doc) {
    notFound();
  }

  const wordCount = doc.content.split(/\s+/).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-4 py-8">
        {/* Back + metadata header */}
        <div className="mb-6">
          <Link
            href="/kb"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            Back to Knowledge Base
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {doc.title}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                  {doc.source}
                </span>
                <span>{wordCount.toLocaleString()} words</span>
                {doc.description && (
                  <span className="hidden sm:inline">{doc.description}</span>
                )}
                {doc.sourceType === "upload" && doc.status && (
                  <span className="uppercase tracking-wide text-[10px] px-1.5 py-0.5 rounded bg-muted">
                    {doc.status}
                  </span>
                )}
              </div>
            </div>
            <Link
              href={`/chat?q=${encodeURIComponent(`Tell me about ${doc.title}`)}&new=1`}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </svg>
              Ask about this
            </Link>
          </div>
        </div>

        {/* Document content */}
        <div className="rounded-md border border-border bg-card p-6 lg:p-8">
          <DocViewer content={doc.content} />
        </div>
      </div>
    </div>
  );
}
