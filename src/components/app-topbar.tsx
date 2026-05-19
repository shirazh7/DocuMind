"use client";

// Slim top bar shows the current page title derived from the pathname.
// This avoids passing title props through layout → page → topbar and
// keeps routing as the single source of truth for navigation state.

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/chat": "Chat",
  "/kb": "Knowledge Base",
  "/eval": "Evaluation Suite",
  "/architecture": "System Architecture",
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
    window.location.reload();
  }

  return (
    <header className="flex items-center gap-3 px-4 h-12 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg hover:bg-accent transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="17"
          height="17"
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

      <h1 className="flex-1 text-[13px] font-medium tracking-tight text-foreground/80">{title}</h1>

      {pathname === "/chat" && (
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
            strokeWidth="2"
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
