"use client";

// ── SIDEBAR: ALWAYS VISIBLE ON DESKTOP ─────────────────────────────────
//
// Always visible (no collapse) to reinforce the enterprise dashboard feel.
// KB documents are listed directly here — one click to any source doc.
// Quick access to source documents is a key differentiator for a knowledge
// assistant: users should see what's available at a glance.
//
// Mobile: overlay with backdrop, controlled by the parent layout state
// so the topbar hamburger can open/close it.
//
// Session switching uses window.location.reload() rather than router.push()
// + setMessages() because useChat in chat-interface.tsx needs to re-run its
// full initializeSession effect with the new localStorage id. React state
// resets cleanly on a full navigation; trying to reset it in-place requires
// threading a "resetSession" callback through multiple component layers.
// The reload is instant on a warm browser (cached assets) so UX impact is low.
//
// Session list is fetched on every pathname change (useEffect dependency).
// This refreshes the list when the user navigates back to /chat after
// creating a new session elsewhere. It does NOT auto-refresh within /chat —
// a new chat appears in the list on next reload or navigation. A WebSocket
// or polling approach would be needed for real-time list updates.
//
// Optimistic delete: the session is removed from local state immediately
// before the API call completes. There is no rollback on failure — a network
// error leaves the item gone from the UI but present in the DB until the next
// sidebar refresh. Acceptable for a demo; production should handle the error.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { DocIcon } from "@/lib/constants";
import type { KnowledgeBaseDocument } from "@/lib/kb/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";

interface ChatSession {
  id: string;
  title: string | null;
  updated_at: string;
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DocIconSvg({ icon }: { icon: DocIcon }) {
  const shared = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (icon) {
    case "rocket":
      return (
        <svg {...shared}>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
      );
    case "alert":
      return (
        <svg {...shared}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "key":
      return (
        <svg {...shared}>
          <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
          <path d="m21 2-9.6 9.6" />
          <circle cx="7.5" cy="15.5" r="5.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...shared}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "database":
      return (
        <svg {...shared}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5V19A9 3 0 0 0 21 19V5" />
          <path d="M3 12A9 3 0 0 0 21 12" />
        </svg>
      );
    case "file":
      return (
        <svg {...shared}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      );
  }
}

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [kbExpanded, setKbExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chat/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { sessions?: ChatSession[] } | null) => {
        if (data?.sessions) setSessions(data.sessions);
      })
      .catch(() => null);
  }, [pathname]);

  useEffect(() => {
    function fetchDocuments() {
      fetch("/api/documents")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { documents?: KnowledgeBaseDocument[] } | null) => {
          if (data?.documents) {
            setDocuments(data.documents);
          }
        })
        .catch(() => null);
    }

    fetchDocuments();
    window.addEventListener("documind-documents-updated", fetchDocuments);
    return () =>
      window.removeEventListener("documind-documents-updated", fetchDocuments);
  }, [pathname]);

  function handleSessionClick(id: string) {
    window.localStorage.setItem("documind-session-id", id);
    if (pathname === "/chat") {
      window.location.reload();
    } else {
      router.push("/chat");
    }
    onClose();
  }

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setPendingDelete(id);
  }

  async function handleDeleteConfirm(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setPendingDelete(null);
    setSessions((prev) => prev.filter((s) => s.id !== id));

    await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" }).catch(() => null);

    const current = window.localStorage.getItem("documind-session-id");
    if (current === id) {
      window.localStorage.removeItem("documind-session-id");
      if (pathname === "/chat") window.location.reload();
    }
  }

  function handleDeleteCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setPendingDelete(null);
  }

  const navItems = [
    {
      href: "/chat",
      label: "Chat",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      ),
    },
    {
      href: "/kb",
      label: "Knowledge Base",
      matchPrefix: true,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      ),
    },
    {
      href: "/eval",
      label: "Evaluation",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      href: "/architecture",
      label: "Architecture",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 2 9l10 6 10-6-10-6Z" />
          <path d="m2 17 10 6 10-6" />
          <path d="m2 13 10 6 10-6" />
        </svg>
      ),
    },
    {
      href: "/platform",
      label: "Platform Capabilities",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ];

  function handleDocClick(slug: string) {
    router.push(`/kb/${slug}`);
    onClose();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[248px] bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        onClick={() => pendingDelete && setPendingDelete(null)}
      >
        {/* Logo / project header */}
        <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-sidebar-border shrink-0">
          <div className="flex items-center justify-center h-6 w-6 rounded bg-foreground text-background text-[10px] font-bold font-mono shrink-0 tracking-tight select-none">
            dm
          </div>
          <span className="text-[14px] font-medium text-sidebar-foreground tracking-tight">DocuMind</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2.5">
          {/* Main nav items */}
          <div className="space-y-px">
            {navItems.map((item) => {
              const active = "matchPrefix" in item && item.matchPrefix
                ? pathname.startsWith(item.href)
                : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[14px] transition-colors duration-100 ${
                    active
                      ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                      : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <span className={`shrink-0 ${active ? "text-sidebar-foreground" : "text-sidebar-foreground/35"}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <Separator className="my-2.5 bg-sidebar-border" />

          {/* Documents section */}
          <div>
            <button
              onClick={() => setKbExpanded(!kbExpanded)}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-[12px] font-medium text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
            >
              Documents
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
                className={`transition-transform duration-150 ${kbExpanded ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {kbExpanded && (
              <div className="mt-px space-y-px">
                {documents.map((doc) => {
                  const docActive = pathname === `/kb/${doc.slug}`;
                  return (
                    <button
                      key={doc.slug}
                      onClick={() => handleDocClick(doc.slug)}
                      className={`flex items-center gap-2 w-full px-2.5 py-[7px] rounded-md text-[13px] transition-colors duration-100 text-left ${
                        docActive
                          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                          : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                      }`}
                    >
                      <span className="shrink-0 opacity-40">
                        <DocIconSvg icon={doc.icon} />
                      </span>
                      <span className="truncate">{doc.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {sessions.length > 0 && (
            <>
              <Separator className="my-2.5 bg-sidebar-border" />

              {/* Recent conversations section */}
              <div>
                <button
                  onClick={() => setHistoryExpanded(!historyExpanded)}
                  className="flex items-center justify-between w-full px-2.5 py-1.5 text-[12px] font-medium text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
                >
                  Recent Chats
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
                    className={`transition-transform duration-150 ${historyExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {historyExpanded && (
                  <div className="mt-px space-y-px">
                    {sessions.map((session) => {
                      const currentId = typeof window !== "undefined"
                        ? window.localStorage.getItem("documind-session-id")
                        : null;
                      const isActive = currentId === session.id && pathname === "/chat";
                      return (
                        <div
                          key={session.id}
                          className={`group flex items-center gap-1 w-full px-2.5 py-[7px] rounded-md text-[13px] transition-colors duration-100 ${
                            isActive
                              ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                              : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                          }`}
                        >
                          <button
                            onClick={() => handleSessionClick(session.id)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          >
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
                              className="shrink-0 opacity-35"
                            >
                              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                            </svg>
                            <span className="flex-1 truncate">
                              {session.title ?? "Untitled conversation"}
                            </span>
                            <span className="shrink-0 text-[11px] opacity-35 tabular-nums font-mono">
                              {formatRelativeTime(session.updated_at)}
                            </span>
                          </button>
                          {pendingDelete === session.id ? (
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleDeleteConfirm(e, session.id)}
                                className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                aria-label="Confirm delete"
                              >
                                Delete
                              </button>
                              <button
                                onClick={handleDeleteCancel}
                                className="text-[11px] px-1 py-0.5 rounded text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
                                aria-label="Cancel"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => handleDeleteClick(e, session.id)}
                              className="shrink-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-0.5 rounded hover:text-red-500"
                              aria-label="Delete conversation"
                              title="Delete conversation"
                            >
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
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="border-t border-sidebar-border px-3 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              title="Sign out"
              aria-label="Sign out"
              className="flex items-center justify-center h-7 w-7 rounded-md text-sidebar-foreground/35 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
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
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </button>
          </div>
          <span className="text-[11px] text-sidebar-foreground/25 font-mono tracking-tight">
            v0.1
          </span>
        </div>
      </aside>
    </>
  );
}
