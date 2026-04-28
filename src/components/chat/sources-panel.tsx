"use client";

// Sources are shown in a collapsible sidebar rather than inline beneath each
// message. This keeps the conversation flow clean while letting users drill into
// evidence on demand — matching how enterprise search tools (Glean, Guru) present
// provenance. Clicking a [1] citation in a message scrolls and highlights the
// matching source card here, creating a two-panel "claim → evidence" workflow.

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
    <div className="w-80 lg:w-96 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Sources</h3>
          <ConfidenceBadge similarity={avgSimilarity} />
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close sources panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
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
        <div className="p-3 space-y-2.5">
          {sources.map((source, i) => (
            <div
              key={`${source.index}-${i}`}
              ref={(el) => {
                refs.current[source.index] = el;
              }}
              className={`rounded-lg border p-3 transition-all duration-200 ${
                highlightedIndex === source.index
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-background"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold bg-primary text-primary-foreground">
                    {source.index}
                  </span>
                  <span className="text-xs font-semibold text-foreground truncate">
                    {source.source}
                  </span>
                </div>
                <ConfidenceBadge similarity={source.similarity} />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {source.section}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-4">
                {source.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
