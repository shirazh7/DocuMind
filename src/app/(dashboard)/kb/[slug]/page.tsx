// ── KB DETAIL PAGE (SERVER COMPONENT) ──────────────────────────────────
//
// Document content is read from the filesystem at request time — not
// bundled into the client. Keeps the client bundle small.
// "Ask about this" button links to /chat?q=... which pre-fills the chat
// input — bridging the read → ask workflow enterprise users expect.

import { notFound } from "next/navigation";
import Link from "next/link";
import { loadDocumentBySlug } from "@/lib/rag/documents";
import { KNOWLEDGE_BASE_DOCS } from "@/lib/constants";
import { DocViewer } from "@/components/kb/doc-viewer";

interface KBDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function KBDetailPage({ params }: KBDetailPageProps) {
  const { slug } = await params;
  const doc = loadDocumentBySlug(slug);

  if (!doc) {
    notFound();
  }

  const meta = KNOWLEDGE_BASE_DOCS.find((d) => d.slug === slug);
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
                {doc.metadata.title}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                  {doc.metadata.source}
                </span>
                <span>{wordCount.toLocaleString()} words</span>
                {meta?.description && (
                  <span className="hidden sm:inline">{meta.description}</span>
                )}
              </div>
            </div>
            <Link
              href={`/chat?q=${encodeURIComponent(`Tell me about the ${doc.metadata.title}`)}`}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </svg>
              Ask about this
            </Link>
          </div>
        </div>

        {/* Document content */}
        <div className="rounded-xl border border-border bg-card p-6 lg:p-8">
          <DocViewer content={doc.content} />
        </div>
      </div>
    </div>
  );
}
