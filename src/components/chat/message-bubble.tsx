"use client";

// ── MESSAGE RENDERING: MARKDOWN + INTERACTIVE CITATIONS ────────────────
//
// Each message iterates message.parts. Text parts go through ReactMarkdown
// with remark-gfm. Tool invocation parts (tool-retrieveDocuments) are not
// rendered visually — the parent (chat-interface) extracts sources from
// them to populate the sources panel.
//
// Citations like [1], [2] are parsed at the <p> and <li> component level
// and rendered as clickable buttons that highlight the matching source.
//
// Earlier approach split text on \n\n to inject citation buttons. That
// broke fenced code blocks containing blank lines — the markdown parser
// saw half a code block. Current design passes the full text to
// ReactMarkdown and intercepts paragraph/list components to insert
// citation buttons without fragmenting the markdown structure.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useState } from "react";
import type { DocuMindMessage, MessageMetadata } from "@/lib/ai/types";

interface MessageBubbleProps {
  message: DocuMindMessage;
  onCitationClick: (index: number) => void;
  // True while this message is the actively streaming assistant turn.
  // Drives the "Thinking…" animated state in the reasoning block.
  isStreaming?: boolean;
}

function renderTextWithCitations(
  text: string,
  onCitationClick: (index: number) => void
) {
  // Split text on citation patterns like [1], [2], etc.
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const citationMatch = part.match(/^\[(\d+)\]$/);
    if (citationMatch) {
      const index = parseInt(citationMatch[1], 10);
      return (
        <button
          key={i}
          onClick={() => onCitationClick(index)}
          className="inline-flex items-center justify-center h-[14px] min-w-[14px] px-1 mx-0.5 rounded text-[9px] font-medium bg-foreground/10 text-foreground/60 hover:bg-foreground/15 hover:text-foreground transition-colors cursor-pointer align-super"
          title={`View source ${index}`}
        >
          {index}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const markdownComponents: Components = {
  pre: ({ children }) => (
    <pre className="bg-muted rounded-md p-4 overflow-x-auto my-3 text-[13px] font-mono border border-border">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono border border-border">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-md border border-border">
      <table className="text-sm border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left font-medium bg-muted text-[11px] text-muted-foreground uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2.5 text-sm last:border-0">{children}</td>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1.5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  h1: ({ children }) => (
    <h1 className="text-[15px] font-semibold mt-5 mb-2.5 tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[14px] font-semibold mt-4 mb-2 tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium mt-3 mb-1 tracking-tight text-foreground/80">{children}</h3>
  ),
  p: ({ children }) => <p className="text-sm leading-[1.75] my-2">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-foreground underline underline-offset-2 decoration-foreground/30 hover:decoration-foreground transition-all"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

export function MessageBubble({ message, onCitationClick, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  // Auto-open when the message has reasoning parts so the user can see the
  // "Thought" content immediately without needing to click. Messages without
  // reasoning parts never render the block, so the default doesn't matter.
  const hasReasoning = message.parts.some(
    (p) => p.type === "reasoning" && "text" in p && (p as { text: string }).text
  );
  const [reasoningOpen, setReasoningOpen] = useState(hasReasoning);
  const metadata = message.metadata as MessageMetadata | undefined;

  // Derive source count directly from the message's tool parts so the footer
  // can show "N sources" without needing a prop from the parent. The same data
  // drives the Sources panel — we just count results instead of rendering them.
  const sourceCount = message.parts.reduce((acc, part) => {
    if (part.type === "tool-retrieveDocuments" && part.state === "output-available") {
      const out = part.output as { results: unknown[] } | undefined;
      return acc + (out?.results?.length ?? 0);
    }
    return acc;
  }, 0);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
        className={`max-w-[85%] lg:max-w-[78%] ${
          isUser
            ? "bg-foreground text-background rounded-lg px-4 py-3"
            : "w-full"
        }`}
      >
        {message.parts.map((part, i) => {
          // ── REASONING PARTS ──────────────────────────────────────────
          // Models such as claude-sonnet-4-5 and deepseek-r1 emit reasoning
          // tokens before the answer. sendReasoning: true in the API route
          // forwards them as part.type === 'reasoning'. We render a collapsible
          // block matching v0's UX:
          //   • While streaming: brain icon pulses, label reads "Thinking…"
          //   • After streaming: label reads "Thought", block auto-opened
          //   • Collapsed state shows a faint one-line preview of the text
          //   • Expanded state shows full reasoning with a left-border accent
          if (part.type === "reasoning" && "text" in part && (part as { text: string }).text) {
            const reasoningText = (part as { text: string }).text;
            // First non-empty line for the collapsed preview snippet
            const previewLine = reasoningText
              .split("\n")
              .map((l) => l.trim())
              .find((l) => l.length > 0) ?? "";
            const preview = previewLine.length > 90
              ? previewLine.slice(0, 90) + "…"
              : previewLine;

            return (
              <div key={i} className="mb-4">
                {/* Toggle header */}
                <button
                  onClick={() => setReasoningOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors group"
                >
                  {/* Brain icon — pulses while the model is actively reasoning */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={isStreaming ? "animate-pulse" : ""}
                  >
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
                  </svg>
                  <span className={isStreaming ? "animate-pulse" : ""}>
                    {isStreaming ? "Thinking…" : "Thought"}
                  </span>
                  {!isStreaming && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform duration-150 ${reasoningOpen ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  )}
                </button>

                {/* Collapsed preview: one faint italic line hinting at the content */}
                {!reasoningOpen && !isStreaming && preview && (
                  <p className="mt-0.5 pl-[18px] text-[11px] text-muted-foreground/35 italic leading-relaxed line-clamp-1">
                    {preview}
                  </p>
                )}

                {/* Expanded reasoning text */}
                {(reasoningOpen || isStreaming) && (
                  <div className="mt-2 pl-3 border-l-2 border-border/60 text-[12px] text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">
                    {reasoningText}
                  </div>
                )}
              </div>
            );
          }

          if (part.type === "text") {
            if (isUser) {
              return (
                <p key={i} className="text-sm leading-relaxed">
                  {part.text}
                </p>
              );
            }

            // True when this is the last text part in the message — used to
            // inject the inline cursor so it appears at the end of the final
            // paragraph rather than floating as a separate element.
            const isLastTextPart =
              isStreaming &&
              !message.parts.slice(i + 1).some((p) => p.type === "text");

            // CSS ::after on the markdown wrapper targets the last <p> rendered
            // by ReactMarkdown and appends an inline blinking block cursor.
            // This keeps the cursor on the same text line as the last streamed
            // word — no separate DOM element required.
            const streamingCursorClass = isLastTextPart
              ? "[&>p:last-child]:after:content-['▊'] [&>p:last-child]:after:animate-pulse [&>p:last-child]:after:ml-[1px] [&>p:last-child]:after:opacity-60 [&>p:last-child]:after:text-[0.7em] [&>p:last-child]:after:align-middle"
              : "";

            const hasCitations = /\[\d+\]/.test(part.text);
            if (hasCitations) {
              return (
                <div key={i} className={`prose-sm ${streamingCursorClass}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      ...markdownComponents,
                      p: ({ children }) => {
                        if (typeof children === "string") {
                          return (
                            <p className="text-sm leading-relaxed my-1">
                              {renderTextWithCitations(children, onCitationClick)}
                            </p>
                          );
                        }
                        // Handle mixed children (strings + elements) from markdown
                        if (Array.isArray(children)) {
                          return (
                            <p className="text-sm leading-relaxed my-1">
                              {children.map((child, ci) => {
                                if (typeof child === "string" && /\[\d+\]/.test(child)) {
                                  return <span key={ci}>{renderTextWithCitations(child, onCitationClick)}</span>;
                                }
                                return child;
                              })}
                            </p>
                          );
                        }
                        return (
                          <p className="text-sm leading-relaxed my-1">{children}</p>
                        );
                      },
                      li: ({ children }) => {
                        if (typeof children === "string" && /\[\d+\]/.test(children)) {
                          return (
                            <li className="text-sm leading-relaxed">
                              {renderTextWithCitations(children, onCitationClick)}
                            </li>
                          );
                        }
                        if (Array.isArray(children)) {
                          return (
                            <li className="text-sm leading-relaxed">
                              {children.map((child, ci) => {
                                if (typeof child === "string" && /\[\d+\]/.test(child)) {
                                  return <span key={ci}>{renderTextWithCitations(child, onCitationClick)}</span>;
                                }
                                return child;
                              })}
                            </li>
                          );
                        }
                        return <li className="text-sm leading-relaxed">{children}</li>;
                      },
                    }}
                  >
                    {part.text}
                  </ReactMarkdown>
                </div>
              );
            }

            return (
              <div key={i} className={streamingCursorClass || undefined}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {part.text}
                </ReactMarkdown>
              </div>
            );
          }

          // Tool parts (tool-retrieveDocuments etc.) are handled by the parent
          // (chat-interface) to extract sources — we don't render them visually
          return null;
        })}

        {/* ── MESSAGE FOOTER ──────────────────────────────────────────────
            Shown only on assistant messages once metadata arrives (after the
            stream finishes). Format: $0.0023 · 3 sources · 2.1s · 11:22 AM
            —
            Cost: estimatedCost is computed server-side from token usage × per-token
            price and sent in the 'finish' metadata part. Displaying it here makes
            the AI Gateway cost-tracking story tangible — each answer's cost
            is visible at a glance, showing fractions of a cent, not dollars.
            —
            Sources: derived above from tool-retrieveDocuments parts on this same
            message, so no prop-drilling from the parent is needed.
            —
            All fields are optional — the footer only mounts when at least one is
            present so partially-received metadata never renders an empty bar. */}
        {!isUser && (metadata?.durationMs != null || metadata?.createdAt != null) && (
          <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground/40">
            {/* Cost per response — drives the "AI Gateway pays off" story.
                estimatedCost is in USD. Format to enough decimal places that
                the non-zero digits are visible:
                  GPT-4.1 Nano ~$0.0001  →  "$0.0001"
                  GPT-4o Mini  ~$0.0003  →  "$0.0003"
                  Claude Sonnet ~$0.01   →  "$0.0105"
                toFixed(6) then strip trailing zeros gives clean output. */}
            {metadata?.estimatedCost != null && metadata.estimatedCost > 0 && (
              <span className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v12" />
                  <path d="M8 9h8M8 15h6" />
                </svg>
                ${metadata.estimatedCost.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}
              </span>
            )}
            {/* Source count — shorthand for "grounded in N chunks of evidence" */}
            {sourceCount > 0 && (
              <span>{sourceCount} {sourceCount === 1 ? "source" : "sources"}</span>
            )}
            {metadata?.durationMs != null && (
              <span className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {(metadata.durationMs / 1000).toFixed(1)}s
              </span>
            )}
            {metadata?.createdAt != null && (
              <span>
                {new Date(metadata.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
