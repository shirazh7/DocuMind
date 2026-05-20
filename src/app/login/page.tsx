"use client";

// ── LOGIN PAGE ─────────────────────────────────────────────────────────
//
// Custom styled page instead of the browser's native Basic Auth dialog.
// The native dialog can't be styled and signals "dev tool" — not
// "enterprise product". Cookie-based auth (set by /api/auth/login);
// proxy.ts checks for the cookie on every request and redirects to /login
// when absent. Using proxy.ts (Next.js 16 replacement for middleware) keeps
// auth at the edge before any page handler runs.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/chat");
        router.refresh();
      } else {
        setError("Invalid username or password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[320px] space-y-6">
        {/* Logo + branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded bg-foreground text-background text-[13px] font-bold font-mono mx-auto select-none">
            dm
          </div>
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">DocuMind</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Enterprise Knowledge Assistant
            </p>
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-[12px] font-medium text-foreground/70">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              required
              autoFocus
              autoComplete="username"
              className="h-9 rounded-md border-border text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[12px] font-medium text-foreground/70">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              autoComplete="current-password"
              className="h-9 rounded-md border-border text-[13px]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/8 border border-destructive/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive shrink-0">
                <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
              </svg>
              <p className="text-[12px] text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full h-9 rounded-md text-[13px] font-medium mt-1" disabled={loading}>
            {loading ? (
              <svg
                className="animate-spin h-3.5 w-3.5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              "Continue"
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/40">
          Acme Engineering &middot; Internal use only
        </p>
      </div>
    </div>
  );
}
