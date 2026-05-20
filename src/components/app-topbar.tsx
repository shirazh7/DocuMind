"use client";

// Slim top bar shows the current page title derived from the pathname.
// This avoids passing title props through layout → page → topbar and
// keeps routing as the single source of truth for navigation state.
//
// "New Chat" clears the localStorage session key then navigates to /chat
// with no query params. A bare reload would preserve ?q= and ?new=1 from
// a KB "Ask about this" link, causing the auto-send effect to re-fire on
// the fresh session. Full navigation clears the URL and forces
// chat-interface.tsx to re-run its session init effect, see no persisted
// id, create a new session, and start fresh.
// Alternative: expose a reset callback from ChatInterface via context —
// avoided here because it couples topbar to a specific child component's
// internal state management, which is fragile across refactors.

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/chat": "Chat",
  "/kb": "Knowledge Base",
  "/eval": "Evaluation Suite",
  "/architecture": "System Architecture",
  "/platform": "Platform Capabilities",
};

interface AppTopbarProps {
  onMenuToggle: () => void;
}

export function AppTopbar({ onMenuToggle }: AppTopbarProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname]
    ?? (pathname.startsWith("/kb/") ? "Knowledge Base" : "DocuMind");

  function handleNewChat() {
    window.localStorage.removeItem("documind-session-id");
    // Navigate to /chat with no query params rather than reloading the current
    // URL. A plain reload would preserve ?q= and ?new=1 from a KB "Ask about
    // this" navigation, causing the auto-send effect to fire again on the new
    // empty session — sending the stale question into the fresh conversation.
    window.location.href = "/chat";
  }

  return (
    <header className="flex items-center gap-3 px-4 h-[52px] border-b border-border bg-background shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors text-foreground/60 hover:text-foreground"
        aria-label="Toggle sidebar"
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
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>

      <h1 className="flex-1 text-[14px] font-medium text-foreground/70 tracking-tight">{title}</h1>

      {pathname === "/chat" && (
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium text-foreground/60 hover:text-foreground hover:bg-accent transition-colors border border-transparent hover:border-border"
          aria-label="New chat"
          title="Start a new conversation"
        >
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
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          New Chat
        </button>
      )}
    </header>
  );
}
