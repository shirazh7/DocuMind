"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KNOWLEDGE_BASE_DOCS } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const MOCK_FILE_META: Record<string, { size: string; updated: string }> = {
  "deployment-runbook": { size: "4.2 KB", updated: "Apr 24, 2026" },
  "incident-response": { size: "3.8 KB", updated: "Apr 22, 2026" },
  "api-auth-guide": { size: "5.1 KB", updated: "Apr 20, 2026" },
  "onboarding-checklist": { size: "3.4 KB", updated: "Apr 18, 2026" },
  "database-migrations": { size: "4.6 KB", updated: "Apr 15, 2026" },
};

export function KBSearch() {
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtered = KNOWLEDGE_BASE_DOCS.filter((doc) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.description.toLowerCase().includes(q)
    );
  });

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
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_100px] sm:grid-cols-[1fr_80px_100px_120px] gap-x-2 px-4 py-2 bg-muted/50 border-b border-border text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Name</span>
            <span>Type</span>
            <span className="hidden sm:block">Size</span>
            <span className="text-right">Modified</span>
          </div>

          {/* File rows */}
          {filtered.map((doc, i) => {
            const meta = MOCK_FILE_META[doc.slug];
            return (
              <Link
                key={doc.slug}
                href={`/kb/${doc.slug}`}
                className={`group grid grid-cols-[1fr_80px_100px] sm:grid-cols-[1fr_80px_100px_120px] gap-x-2 items-center px-4 py-2.5 hover:bg-accent/50 transition-colors ${
                  i < filtered.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                {/* File name with icon */}
                <div className="flex items-center gap-2.5 min-w-0">
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
                    className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M10 9H8" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                  </svg>
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block group-hover:text-primary transition-colors">
                      {doc.slug}.md
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {doc.title}
                    </span>
                  </div>
                </div>

                {/* Type */}
                <span className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                    .md
                  </span>
                </span>

                {/* Size */}
                <span className="hidden sm:block text-xs text-muted-foreground">
                  {meta?.size ?? "—"}
                </span>

                {/* Modified */}
                <span className="text-xs text-muted-foreground text-right">
                  {meta?.updated ?? "—"}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* File count */}
      <p className="text-[11px] text-muted-foreground mt-3">
        {filtered.length} document{filtered.length !== 1 ? "s" : ""}
        {query.trim() ? ` matching "${query}"` : " in knowledge base"}
      </p>

      {/* Upload mock dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Document uploads are not available in this demo. In production,
              this would accept Markdown, PDF, or plain text files, chunk them
              automatically, generate embeddings, and add them to the knowledge
              base.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
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
              className="mx-auto text-muted-foreground/50 mb-3"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <p className="text-sm text-muted-foreground">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              .md, .txt, .pdf (max 10MB)
            </p>
          </div>
          <DialogFooter showCloseButton>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
