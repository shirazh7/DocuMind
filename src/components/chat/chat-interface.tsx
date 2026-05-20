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
// ?q= + ?new=1 flow (KB "Ask about this"):
//   1. ?new=1 causes initializeSession to clear the localStorage session
//      key before creating a new one, so the user always lands on a fresh
//      conversation — not a continuation of whatever they were discussing.
//   2. Once the new session is hydrated and messages.length === 0, an
//      autoSent ref-guarded effect fires handleSend(initialQuery) exactly
//      once. The ref prevents double-firing in React Strict Mode.
//
// Messages are consumed via message.parts — text parts go through
// ReactMarkdown; tool invocation parts are where source data is extracted.
// useMemo filters for parts with type === "tool-retrieveDocuments" and
// state === "output-available" to populate the sources panel.
//
// Status handling: "submitted" → bouncing dots, "streaming" with no text yet →
// same dots (covers TTFT gap + tool/reasoning phase), "streaming" with text →
// inline ▊ cursor at end of last paragraph, "error" → retry option.
// Stop button calls stop() during streaming.
//
// The type system is end-to-end: DocuMindMessage extends UIMessage<MessageMetadata>
// so the client knows exactly what metadata shape to expect.
// message.metadata?.estimatedCost is available after streaming completes.
//
// DefaultChatTransport separates the streaming protocol from the hook —
// you could swap to WebSockets or a custom transport without changing UI code.
//
// TODO(production): Add authentication check — redirect unauthenticated users.

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./message-bubble";
import { SourcesPanel } from "./sources-panel";
import { SuggestedQuestions } from "./suggested-questions";
import { ModelSelector } from "./model-selector";
import { DEFAULT_MODEL_ID, type ModelConfig } from "@/lib/ai/models";
import type { DocuMindMessage, MessageMetadata } from "@/lib/ai/types";

interface Source {
  index: number;
  source: string;
  section: string;
  content: string;
  similarity: number;
}

interface ChatInterfaceProps {
  allowedModels?: ModelConfig[];
}

export function ChatInterface({ allowedModels }: ChatInterfaceProps) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  // ?new=1 is set by the KB "Ask about this" link to force a fresh session.
  const isNewChat = searchParams.get("new") === "1";
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
  // Prevents auto-send from firing more than once (React Strict Mode double-invokes effects).
  const autoSentRef = useRef(false);

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
        // When arriving from the KB "Ask about this" link (?new=1), discard
        // any existing session so the user starts a clean conversation about
        // the document rather than appending to an unrelated prior session.
        if (isNewChat) {
          window.localStorage.removeItem("documind-session-id");
        }

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

  // Derive follow-up question chips from the latest assistant message's
  // suggestFollowUps tool call. Same extraction pattern as currentSources —
  // the model calls this tool after answering, the client reads the output.
  // Only shown when status === "ready" so chips don't appear mid-stream.
  const followUpQuestions = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return [];

    for (const part of lastAssistant.parts) {
      if (
        part.type === "tool-suggestFollowUps" &&
        part.state === "output-available"
      ) {
        const output = part.output as { questions: string[] } | undefined;
        return output?.questions ?? [];
      }
    }
    return [];
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

  // Auto-send the pre-filled query when arriving from KB "Ask about this".
  // Fires once: after the session is hydrated, the conversation is empty
  // (confirming this is a fresh session, not one with existing history),
  // and the ref confirms it hasn't already been sent. autoSentRef prevents
  // React Strict Mode's double-invocation from sending the message twice.
  // Placed after handleSend declaration so the dependency is in scope.
  useEffect(() => {
    if (
      sessionHydrated &&
      initialQuery &&
      messages.length === 0 &&
      !autoSentRef.current
    ) {
      autoSentRef.current = true;
      handleSend(initialQuery);
      setInput("");
    }
  }, [sessionHydrated, initialQuery, messages.length, handleSend]);

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

  // ── EXPORT CONVERSATION ──────────────────────────────────────────────────
  // Formats the full conversation as markdown and copies it to the clipboard.
  // Enterprise teams share AI-generated answers through Slack, email, and docs —
  // making conversations portable is how adoption spreads beyond the first user.
  //
  // Format: headings, bold speaker labels, answer text, and a sources footnote
  // derived from the same tool-retrieveDocuments parts used by the sources panel.
  // Tool parts are skipped; only human-readable text parts are included.
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(async () => {
    const date = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const lines: string[] = [
      "# DocuMind Conversation",
      `*Exported ${date}, ${time}*`,
      "",
      "---",
      "",
    ];

    for (const msg of messages) {
      const speaker = msg.role === "user" ? "**You**" : "**DocuMind**";
      const textParts = msg.parts
        .filter((p) => p.type === "text" && "text" in p)
        .map((p) => (p as { text: string }).text)
        .join("\n\n");

      if (!textParts.trim()) continue;

      lines.push(`${speaker}: ${textParts}`);

      // Append a sources footnote on assistant messages when retrieval was used.
      // Mirrors what the Sources panel shows — source title + section name.
      if (msg.role === "assistant") {
        const sourceParts: string[] = [];
        for (const part of msg.parts) {
          if (part.type === "tool-retrieveDocuments" && part.state === "output-available") {
            const out = part.output as {
              results: { source: string; section: string }[];
            } | undefined;
            out?.results?.forEach((r) => {
              sourceParts.push(`${r.source} — ${r.section}`);
            });
          }
        }
        if (sourceParts.length > 0) {
          lines.push("", `> **Sources:** ${sourceParts.join(" · ")}`);
        }
      }

      lines.push("", "---", "");
    }

    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [messages]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sub-bar: model selector + right-side actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
          <ModelSelector
            modelId={modelId}
            onModelChange={setModelId}
            lastCost={lastCost}
            disabled={isActive}
            allowedModels={allowedModels}
          />
          <div className="flex items-center gap-1">
            {currentSources.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[12px] gap-1.5 text-muted-foreground hover:text-foreground font-medium"
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
                {currentSources.length} sources
              </Button>
            )}
            {/* Export button — shown once there are messages to share.
                Copies the conversation as markdown so teams can paste it into
                Slack, Notion, or email without losing source attribution. */}
            {messages.length > 0 && !isActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleExport}
                title="Copy conversation as markdown"
              >
                {copied ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-green-500"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
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
                    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  </svg>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Non-stream error banner (hydration failures, rate limits while idle) */}
        {errorMessage && status !== "error" && (
          <div className="flex items-center gap-3 mx-4 mt-3 px-4 py-2.5 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-700 dark:text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            <span className="flex-1">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        )}

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
              {messages.map((message, idx) => (
                <MessageBubble
                  key={message.id}
                  message={message as DocuMindMessage}
                  onCitationClick={handleCitationClick}
                  isStreaming={
                    // Pass true only for the last assistant message while the
                    // stream is active — drives the "Thinking…" animated state.
                    isActive &&
                    message.role === "assistant" &&
                    idx === messages.length - 1
                  }
                />
              ))}

              {/* Loading indicator — shown in two phases:
                  1. "submitted": request sent, waiting for the first stream chunk.
                  2. "streaming" with no text yet: stream has started but the
                     model is still in the tool-call or reasoning phase before
                     any visible text tokens arrive (TTFT gap). Without this,
                     models without thinking tokens show a blank gap between the
                     user message and the first word appearing. */}
              {(() => {
                const lastMsg = messages[messages.length - 1];
                const lastMsgHasText =
                  lastMsg?.role === "assistant" &&
                  lastMsg.parts.some(
                    (p) =>
                      p.type === "text" &&
                      "text" in p &&
                      (p as { text: string }).text.length > 0
                  );
                const showIndicator =
                  status === "submitted" ||
                  (status === "streaming" && !lastMsgHasText);
                if (!showIndicator) return null;
                return (
                  <div className="flex justify-start pl-1">
                    <div className="flex items-center gap-2 text-muted-foreground/60 text-[12px]">
                      <div className="flex gap-[3px]">
                        <span className="h-1 w-1 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1 w-1 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1 w-1 rounded-full bg-foreground/40 animate-bounce" />
                      </div>
                      Thinking…
                    </div>
                  </div>
                );
              })()}

              {/* Streaming cursor is now rendered inline inside MessageBubble
                  via the isStreaming prop — removing it from here prevents it
                  appearing as a separate list item below the active message. */}

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

        {/* Follow-up question chips ───────────────────────────────────────
            Shown only when idle (status === "ready") and the last assistant
            message included a suggestFollowUps tool call. Clicking a chip
            sends it immediately — no typing required to explore the
            knowledge base further. Chips disappear the moment a new message is
            sent (status leaves "ready"), preventing stale suggestions. */}
        {status === "ready" && followUpQuestions.length > 0 && (
          <div className="px-4 pb-3">
            <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
              {followUpQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-[12px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 hover:bg-muted transition-all duration-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-border bg-background px-4 pt-3 pb-5">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-lg border border-border bg-background px-3.5 py-2.5 focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Acme's documentation..."
                disabled={isActive || !sessionHydrated}
                rows={1}
                className="flex-1 resize-none bg-transparent text-[14px] placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 py-1 leading-relaxed"
                style={{ minHeight: "28px", maxHeight: "160px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height =
                    Math.min(target.scrollHeight, 160) + "px";
                }}
              />
              <div className="shrink-0 pb-0.5">
                {isActive ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-md shadow-none"
                    onClick={stop}
                    aria-label="Stop generating"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-md"
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
            <p className="text-[12px] text-muted-foreground/40 text-center mt-2">
              Answers grounded in Acme Engineering documentation · Chat history is persisted per session
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
