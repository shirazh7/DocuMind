"use client";

// TODO(production): Guard this layout with authentication middleware (e.g., NextAuth /
// Clerk / Vercel Auth). Redirect unauthenticated users to a login page.
// TODO(production): Inject user identity into React context here so child pages can
// personalise content and the API routes can enforce per-user rate limits.

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
