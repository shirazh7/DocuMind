"use client";

// ── KB SEARCH & DOCUMENT MANAGER ───────────────────────────────────────
//
// Renders the Knowledge Base page: a searchable list of all documents
// (static + user-uploaded), an upload dialog, and per-row delete actions.
//
// Static documents (defined in lib/constants.ts) are read-only — they
// power the demo and cannot be deleted from the UI. User-uploaded docs
// show a Delete button; static docs show a "Protected" badge instead.
//
// After any mutation (upload or delete), a custom DOM event
// "documind-documents-updated" is dispatched so the sidebar can refresh
// its document list without a full page reload or shared state.
//
// Polling: documents in "pending" or "processing" status are being indexed
// by the Workflow. The component polls /api/documents every 3 s until all
// docs reach a terminal state — see the useEffect comment below.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { KnowledgeBaseDocument } from "@/lib/kb/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function formatBytes(value: number | null) {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function extensionBadge(filename: string) {
  const ext = filename.toLowerCase().split(".").pop();
  if (!ext) return ".txt";
  if (ext === "docx") return ".docx";
  if (ext === "pdf") return ".pdf";
  if (ext === "md") return ".md";
  if (ext === "txt") return ".txt";
  return `.${ext}`;
}

export function KBSearch() {
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchDocuments() {
    const response = await fetch("/api/documents", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load documents.");
    }
    const data = (await response.json()) as { documents?: KnowledgeBaseDocument[] };
    setDocuments(data.documents ?? []);
  }

  // Initial fetch on mount.
  useEffect(() => {
    fetch("/api/documents", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { documents?: KnowledgeBaseDocument[] } | null) => {
        if (data?.documents) {
          setDocuments(data.documents);
        }
      })
      .catch(() => null);
  }, []);

  // Poll while any document is still being ingested by the Workflow.
  // The Workflow runs asynchronously after upload — status transitions from
  // "pending" → "processing" → "ready" (or "failed") in Neon. Without polling
  // the user would need to manually refresh to see the final state.
  // The effect re-runs whenever `documents` changes, so the interval is
  // automatically cleared once all docs reach a terminal state.
  useEffect(() => {
    const hasPending = documents.some(
      (d) => d.status === "pending" || d.status === "processing"
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchDocuments().catch(() => null);
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  const filtered = useMemo(() => documents.filter((doc) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.description.toLowerCase().includes(q) ||
      doc.source.toLowerCase().includes(q)
    );
  }), [documents, query]);

  // Upload flow: POST multipart/form-data to /api/documents, which stores
  // the file in Vercel Blob and creates a user_documents row. The server
  // then fires docIngestWorkflow asynchronously — text extraction and
  // embedding happen in the background, so the upload response returns
  // immediately and the polling effect above tracks progress via status.
  async function handleUpload() {
    if (!selectedFile) {
      setUploadError("Select a .md, .txt, .pdf, or .docx file to upload.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const body = new FormData();
      body.append("file", selectedFile);
      const response = await fetch("/api/documents", {
        method: "POST",
        body,
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }
      setSelectedFile(null);
      setUploadOpen(false);
      await fetchDocuments();
      // Notify the sidebar to refresh its document list.
      window.dispatchEvent(new Event("documind-documents-updated"));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDocument(id: string, title: string) {
    const confirmed = window.confirm(`Delete "${title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Delete failed.");
      }
      await fetchDocuments();
      // Notify the sidebar to refresh its document list.
      window.dispatchEvent(new Event("documind-documents-updated"));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents..."
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={() => setUploadOpen(true)}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1.5"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          Upload
        </Button>
      </div>

      {/* File list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">
            No documents matching &ldquo;{query}&rdquo;
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_90px] sm:grid-cols-[1fr_80px_90px_120px_80px] gap-x-2 px-4 py-2 bg-muted/50 border-b border-border text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Name</span>
            <span>Type</span>
            <span>Size</span>
            <span className="text-right">Modified</span>
            <span className="text-right hidden sm:block">Actions</span>
          </div>

          {filtered.map((doc, i) => {
            const filename = doc.sourceType === "static" ? `${doc.slug}.md` : doc.source;
            return (
              <div
                key={doc.slug}
                className={`group grid grid-cols-[1fr_80px_90px] sm:grid-cols-[1fr_80px_90px_120px_80px] gap-x-2 items-center px-4 py-2.5 hover:bg-accent/50 transition-colors ${
                  i < filtered.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <Link href={`/kb/${doc.slug}`} className="flex items-center gap-2.5 min-w-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M10 9H8" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                  </svg>
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block group-hover:text-foreground transition-colors">
                      {filename}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {doc.title}
                    </span>
                  </div>
                </Link>

                <Link href={`/kb/${doc.slug}`} className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                    {extensionBadge(filename)}
                  </span>
                </Link>

                <Link href={`/kb/${doc.slug}`} className="text-xs text-muted-foreground">
                  {formatBytes(doc.sizeBytes)}
                </Link>

                <div className="text-right">
                  <Link href={`/kb/${doc.slug}`} className="text-xs text-muted-foreground text-right">
                    {formatDate(doc.updatedAt)}
                  </Link>
                </div>

                <div className="hidden sm:flex items-center justify-end">
                  {/* Static docs are protected: deleting them would remove the
                      application's base knowledge base. Only user-uploaded docs
                      expose the Delete button; static ones show "Protected". */}
                  {doc.sourceType === "upload" ? (
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.title)}
                      disabled={deletingId === doc.id}
                      className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-50"
                      aria-label={`Delete ${doc.title}`}
                    >
                      {deletingId === doc.id ? "Deleting…" : "Delete"}
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground border border-border rounded px-2 py-1">
                      Protected
                    </span>
                  )}
                </div>
                {doc.sourceType === "upload" && doc.status && doc.status !== "ready" && (
                  <span className="col-span-full text-[10px] text-amber-600 mt-1">
                    Index status: {doc.status}
                  </span>
                )}
                {doc.sourceType === "upload" && doc.status === "failed" && doc.error && (
                  <span className="col-span-full text-[10px] text-red-600 mt-1">
                    Failure reason: {doc.error}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* File count */}
      <p className="text-[11px] text-muted-foreground mt-3">
        {filtered.length} document{filtered.length !== 1 ? "s" : ""}
        {query.trim() ? ` matching "${query}"` : " in knowledge base"}
      </p>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload Markdown, text, PDF, or DOCX files. The file is stored in Vercel
              Blob, text is extracted server-side, then indexed asynchronously via Workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto text-muted-foreground mb-3"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <p className="text-sm text-muted-foreground">
              Select a file to upload
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              .md, .txt, .pdf, .docx (max 10MB)
            </p>
            <Input
              type="file"
              accept=".md,.txt,.pdf,.docx,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="mt-4"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
            />
          </div>
          {selectedFile && (
            <p className="text-xs text-muted-foreground text-center">
              Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
            </p>
          )}
          {uploadError && (
            <p className="text-xs text-red-500 text-center">{uploadError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Close
            </Button>
            <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
              {isUploading ? "Uploading..." : "Upload & Index"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
