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
import type { DocuMindMessage } from "@/lib/ai/types";

interface MessageBubbleProps {
  message: DocuMindMessage;
  onCitationClick: (index: number) => void;
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
          className="inline-flex items-center justify-center h-[15px] min-w-[15px] px-1 mx-0.5 rounded-full text-[9px] font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer align-super"
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
    <pre className="bg-muted/70 rounded-xl p-3.5 overflow-x-auto my-3 text-[13px] font-mono border border-border/50">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted/80 px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-border/40">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-xl border border-border">
      <table className="text-[13px] border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left font-semibold bg-muted/50 text-xs">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 px-3 py-2 text-[13px] last:border-0">{children}</td>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="text-[13px] leading-relaxed">{children}</li>,
  h1: ({ children }) => (
    <h1 className="text-[15px] font-semibold mt-4 mb-2 tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[14px] font-semibold mt-3 mb-1.5 tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-semibold mt-2.5 mb-1 tracking-tight">{children}</h3>
  ),
  p: ({ children }) => <p className="text-[13px] leading-[1.65] my-1.5">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

export function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] lg:max-w-[78%] ${
          isUser
            ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-[5px] px-4 py-2.5 shadow-sm"
            : "w-full"
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            if (isUser) {
              return (
                <p key={i} className="text-[13px] leading-relaxed">
                  {part.text}
                </p>
              );
            }

            const hasCitations = /\[\d+\]/.test(part.text);
            if (hasCitations) {
              return (
                <div key={i} className="prose-sm">
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
              <ReactMarkdown
                key={i}
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {part.text}
              </ReactMarkdown>
            );
          }

          // Tool parts (tool-retrieveDocuments etc.) are handled by the parent
          // (chat-interface) to extract sources — we don't render them visually
          return null;
        })}
      </div>
    </div>
  );
}
