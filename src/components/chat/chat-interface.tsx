"use client";

// ── CLIENT-SIDE CHAT ───────────────────────────────────────────────────
// useChat from @ai-sdk/react + DefaultChatTransport from the ai package.
// The transport is configured with the API endpoint; body includes modelId
// from component state so the server knows which model to use.
//
// Input is manual useState, NOT the hook's built-in state. Why: we need
// to pre-fill from URL query params (?q=) when navigating from the KB
// "Ask about this" button. sendMessage({ text }) sends the message.
//
// Messages are consumed via message.parts — text parts go through
// ReactMarkdown; tool invocation parts are where source data is extracted.
// useMemo filters for parts with type === "tool-retrieveDocuments" and
// state === "output-available" to populate the sources panel.
//
// Status handling: "submitted" → thinking indicator, "streaming" → cursor,
// "error" → retry option. Stop button calls stop() during streaming.
//
// The type system is end-to-end: DocuMindMessage extends UIMessage<MessageMetadata>
// so the client knows exactly what metadata shape to expect.
// message.metadata?.estimatedCost is available after streaming completes.
//
// DefaultChatTransport separates the streaming protocol from the hook —
// you could swap to WebSockets or a custom transport without changing UI code.
//
// PRODUCTION: Add authentication check — redirect unauthenticated users.

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

interface Source {
  index: number;
  source: string;
  section: string;
  content: string;
  similarity: number;
}

export function ChatInterface() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [input, setInput] = useState(initialQuery);
  const [showSources, setShowSources] = useState(false);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, setMessages, status, stop } = useChat<
    DocuMindMessage & { metadata?: MessageMetadata }
  >({
    id: sessionId ?? undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    onError: (error) => {
      setErrorMessage(
        error.message.includes("429")
          ? "Rate limit reached. Please wait a moment and retry."
          : "Something went wrong. Please try again."
      );
    },
  });

  const isActive = status === "streaming" || status === "submitted";

  useEffect(() => {
    let cancelled = false;

    const initializeSession = async () => {
      try {
        const persistedSessionId =
          window.localStorage.getItem("documind-session-id");

        let resolvedSessionId = persistedSessionId;
        if (!resolvedSessionId) {
          const createResponse = await fetch("/api/chat/sessions", {
            method: "POST",
          });
          if (!createResponse.ok) {
            throw new Error("Failed to create chat session");
          }

          const created = (await createResponse.json()) as { sessionId: string };
          resolvedSessionId = created.sessionId;
          window.localStorage.setItem("documind-session-id", resolvedSessionId);
        }

        if (cancelled) return;
        setSessionId(resolvedSessionId);

        const historyResponse = await fetch(
          `/api/chat/sessions/${resolvedSessionId}/messages`,
          { cache: "no-store" }
        );

        if (!historyResponse.ok) {
          throw new Error("Failed to load persisted chat history");
        }

        const payload = (await historyResponse.json()) as {
          messages?: DocuMindMessage[];
        };

        if (!cancelled && Array.isArray(payload.messages)) {
          setMessages(payload.messages);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage(
            "Could not restore chat history. You can continue with a new conversation."
          );
        }
      } finally {
        if (!cancelled) {
          setSessionHydrated(true);
        }
      }
    };

    initializeSession();
    return () => {
      cancelled = true;
    };
  }, [setMessages]);

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
      if (!text.trim() || isActive || !sessionId) return;
      setErrorMessage(null);
      sendMessage(
        { text: text.trim() },
        {
          body: { modelId, sessionId },
        }
      );
      setInput("");
      setHighlightedSource(null);
    },
    [isActive, modelId, sendMessage, sessionId]
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
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/50 bg-background/60 backdrop-blur-sm">
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
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowSources(!showSources)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
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
          {!sessionHydrated ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Restoring conversation history...
            </div>
          ) : messages.length === 0 ? (
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
                <div className="flex justify-start pl-1">
                  <div className="flex items-center gap-2.5 text-muted-foreground/70 text-[13px]">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
                    </div>
                    Searching documentation…
                  </div>
                </div>
              )}

              {/* Streaming cursor */}
              {status === "streaming" && (
                <div className="flex justify-start pl-1">
                  <span className="inline-block w-[3px] h-4 bg-primary/60 animate-pulse rounded-full" />
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
                      {errorMessage ?? "Something went wrong. Please try again."}
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
        <div className="border-t border-border bg-background/80 backdrop-blur-xl px-4 pt-3 pb-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary/40 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Acme's documentation..."
                disabled={isActive || !sessionHydrated}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 py-1.5"
                style={{ minHeight: "28px", maxHeight: "140px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height =
                    Math.min(target.scrollHeight, 140) + "px";
                }}
              />
              <div className="shrink-0 pb-0.5">
                {isActive ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg shadow-none border-border/60"
                    onClick={stop}
                    aria-label="Stop generating"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-lg shadow-sm"
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || !sessionHydrated}
                    aria-label="Send message"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12 7-7 7 7" />
                      <path d="M12 19V5" />
                    </svg>
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
              Answers grounded in Acme Engineering documentation. Chat history is persisted per session.
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
