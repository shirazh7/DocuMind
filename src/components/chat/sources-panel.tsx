"use client";

// ── SOURCES PANEL: COLLAPSIBLE SIDEBAR ─────────────────────────────────
//
// Shows retrieved document chunks with source title, section name, text
// preview, and per-chunk confidence badge. Clicking a [1] citation in a
// message scrolls and highlights the matching source card here —
// creating a "claim → evidence" workflow.
//
// Sidebar rather than inline keeps the conversation flow clean while
// letting users drill into evidence on demand. Matches how enterprise
// search tools (Glean, Guru) present provenance.

import { ConfidenceBadge } from "./confidence-badge";
import { useEffect, useRef } from "react";

interface Source {
  index: number;
  source: string;
  section: string;
  content: string;
  similarity: number;
}

interface SourcesPanelProps {
  sources: Source[];
  highlightedIndex: number | null;
  onClose: () => void;
}

export function SourcesPanel({
  sources,
  highlightedIndex,
  onClose,
}: SourcesPanelProps) {
  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlightedIndex !== null && refs.current[highlightedIndex]) {
      refs.current[highlightedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlightedIndex]);

  if (sources.length === 0) return null;

  const avgSimilarity =
    sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;

  return (
    <div className="w-72 lg:w-80 border-l border-border bg-background/95 backdrop-blur-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold tracking-tight">Sources</h3>
          <ConfidenceBadge similarity={avgSimilarity} />
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close sources panel"
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
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-3 space-y-2">
          {sources.map((source, i) => (
            <div
              key={`${source.index}-${i}`}
              ref={(el) => {
                refs.current[source.index] = el;
              }}
              className={`rounded-2xl border p-3 transition-all duration-200 ${
                highlightedIndex === source.index
                  ? "border-primary/30 bg-primary/5 ring-1 ring-primary/15 shadow-sm"
                  : "border-border/60 bg-card hover:border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold bg-primary/10 text-primary shrink-0">
                    {source.index}
                  </span>
                  <span className="text-[12px] font-medium text-foreground truncate">
                    {source.source}
                  </span>
                </div>
                <ConfidenceBadge similarity={source.similarity} />
              </div>
              <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                {source.section}
              </span>
              <p className="text-[11.5px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-4">
                {source.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
