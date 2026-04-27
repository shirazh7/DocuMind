"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./message-bubble";
import { SourcesPanel } from "./sources-panel";
import { SuggestedQuestions } from "./suggested-questions";
import { ModelSelector } from "./model-selector";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import type { DocuMindMessage, MessageMetadata } from "@/lib/ai/types";

// PRODUCTION: Add authentication check here — redirect unauthenticated users
// to login. Use next-auth or Vercel Auth for session management.

interface Source {
  index: number;
  source: string;
  section: string;
  content: string;
  similarity: number;
}

export function ChatInterface() {
  const searchParams = useSearchParams();
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [input, setInput] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(
    null
  );
  const [prefillHandled, setPrefillHandled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, stop } = useChat<
    DocuMindMessage & { metadata?: MessageMetadata }
  >({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const isActive = status === "streaming" || status === "submitted";

  // Handle ?q= query param prefill from sidebar doc clicks
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !prefillHandled) {
      setPrefillHandled(true);
      setInput(q);
    }
  }, [searchParams, prefillHandled]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  // Derive sources from the latest assistant message's tool parts
  const currentSources = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return [];

    const sources: Source[] = [];
    for (const part of lastAssistant.parts) {
      if (
        part.type === "tool-retrieveDocuments" &&
        part.state === "output-available"
      ) {
        const result = part.output as {
          results: Source[];
          avgSimilarity: number;
        } | undefined;
        if (result?.results) {
          sources.push(...result.results);
        }
      }
    }
    return sources;
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isActive) return;
      sendMessage(
        { text: text.trim() },
        {
          body: { modelId },
        }
      );
      setInput("");
      setHighlightedSource(null);
    },
    [isActive, modelId, sendMessage]
  );

  const handleCitationClick = useCallback(
    (index: number) => {
      setShowSources(true);
      setHighlightedSource(index);
    },
    []
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  // Get cost from last assistant message metadata
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const lastCost = (lastAssistant?.metadata as MessageMetadata | undefined)
    ?.estimatedCost;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sub-bar: model selector + sources toggle */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/50">
          <ModelSelector
            modelId={modelId}
            onModelChange={setModelId}
            lastCost={lastCost}
            disabled={isActive}
          />
          {currentSources.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowSources(!showSources)}
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
                className="mr-1"
              >
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              </svg>
              Sources ({currentSources.length})
            </Button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <SuggestedQuestions onSelect={(q) => handleSend(q)} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message as DocuMindMessage}
                  onCitationClick={handleCitationClick}
                />
              ))}

              {/* Streaming indicator */}
              {status === "submitted" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                    </div>
                    Searching documentation...
                  </div>
                </div>
              )}

              {/* Streaming cursor */}
              {status === "streaming" && (
                <div className="flex justify-start">
                  <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse rounded-sm" />
                </div>
              )}

              {/* Error state */}
              {status === "error" && (
                <div className="flex justify-start">
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m15 9-6 6" />
                      <path d="m9 9 6 6" />
                    </svg>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Something went wrong. Please try again.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={() => {
                        const lastUser = [...messages].reverse().find((m) => m.role === "user");
                        if (lastUser) {
                          const textPart = lastUser.parts.find((p) => p.type === "text");
                          if (textPart && "text" in textPart) {
                            handleSend(textPart.text);
                          }
                        }
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about Acme's documentation..."
                  disabled={isActive}
                  rows={1}
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 disabled:opacity-50 transition-all"
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height =
                      Math.min(target.scrollHeight, 120) + "px";
                  }}
                />
              </div>
              {isActive ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-xl shrink-0"
                  onClick={stop}
                  aria-label="Stop generating"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-11 w-11 rounded-xl shrink-0"
                  onClick={() => handleSend(input)}
                  disabled={!input.trim()}
                  aria-label="Send message"
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
                    <path d="m5 12 7-7 7 7" />
                    <path d="M12 19V5" />
                  </svg>
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              DocuMind answers are grounded in Acme Engineering documentation. Always verify critical information.
            </p>
          </div>
        </div>
      </div>

      {/* Sources sidebar */}
      {showSources && (
        <SourcesPanel
          sources={currentSources}
          highlightedIndex={highlightedSource}
          onClose={() => setShowSources(false)}
        />
      )}
    </div>
  );
}
