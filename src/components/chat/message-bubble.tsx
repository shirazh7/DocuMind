"use client";

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
          className="inline-flex items-center justify-center h-4 min-w-4 px-1 mx-0.5 rounded text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/80 transition-colors cursor-pointer align-super"
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
    <pre className="bg-muted rounded-lg p-3 overflow-x-auto my-2 text-sm font-mono">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-sm border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-3 py-1.5 text-left font-semibold bg-muted text-xs">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-1.5 text-sm">{children}</td>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  h1: ({ children }) => (
    <h1 className="text-lg font-semibold mt-3 mb-1.5">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold mt-2.5 mb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }) => <p className="text-sm leading-relaxed my-1">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
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
        className={`max-w-[85%] lg:max-w-[75%] ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5"
            : ""
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            if (isUser) {
              return (
                <p key={i} className="text-sm leading-relaxed">
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
