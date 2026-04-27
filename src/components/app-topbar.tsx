"use client";

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

  return (
    <header className="flex items-center gap-3 px-4 h-12 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
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

      <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
    </header>
  );
}
