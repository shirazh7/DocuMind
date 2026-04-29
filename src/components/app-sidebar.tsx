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

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { KNOWLEDGE_BASE_DOCS, type DocIcon } from "@/lib/constants";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";

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
  ];

  function handleDocClick(slug: string) {
    router.push(`/kb/${slug}`);
    onClose();
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-60 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border shrink-0">
          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
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
              className="text-primary-foreground"
            >
              <path d="M12 3 2 9l10 6 10-6-10-6Z" />
              <path d="m2 17 10 6 10-6" />
              <path d="m2 13 10 6 10-6" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">DocuMind</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {/* Main nav items */}
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const active = "matchPrefix" in item && item.matchPrefix
                ? pathname.startsWith(item.href)
                : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>

          <Separator className="my-3" />

          {/* Knowledge Base section */}
          <div>
            <button
              onClick={() => setKbExpanded(!kbExpanded)}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Knowledge Base
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
              <div className="mt-0.5 space-y-0.5">
                {KNOWLEDGE_BASE_DOCS.map((doc) => {
                  const docActive = pathname === `/kb/${doc.slug}`;
                  return (
                    <button
                      key={doc.slug}
                      onClick={() => handleDocClick(doc.slug)}
                      className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                        docActive
                          ? "bg-accent/70 text-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                    >
                      <span className="shrink-0 opacity-60">
                        <DocIconSvg icon={doc.icon} />
                      </span>
                      <span className="truncate">{doc.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Bottom */}
        <div className="border-t border-border px-3 py-2.5 flex items-center justify-between shrink-0">
          <ThemeToggle />
          <span className="text-[10px] text-muted-foreground font-mono">
            Vercel AI SDK
          </span>
        </div>
      </aside>
    </>
  );
}
