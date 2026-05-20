"use client";

// Authentication is enforced by src/proxy.ts before any dashboard route renders.
// User identity is resolved via getCurrentUserId() (cookie + IP fallback) and
// used by API routes to enforce per-user rate limits via Upstash.

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AppTopbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
