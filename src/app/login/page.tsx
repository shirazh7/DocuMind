"use client";

// ── LOGIN PAGE ─────────────────────────────────────────────────────────
//
// Custom styled page instead of the browser's native Basic Auth dialog.
// The native dialog can't be styled and signals "dev tool" — not
// "enterprise product". Cookie-based auth (set by /api/auth/login);
// the middleware checks for the cookie on every request.

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
      <div className="w-full max-w-[340px] space-y-7">
        {/* Logo + branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mx-auto shadow-lg shadow-primary/20">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
              <path d="M8 10h10M8 16h16M8 22h12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="24" cy="10" r="3" fill="rgba(255,255,255,0.5)" />
            </svg>
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">DocuMind</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Enterprise Knowledge Assistant
            </p>
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-[13px] font-medium text-foreground/80">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoFocus
              autoComplete="username"
              className="h-11 rounded-xl border-border/70 bg-card shadow-sm text-[13px] focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[13px] font-medium text-foreground/80">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className="h-11 rounded-xl border-border/70 bg-card shadow-sm text-[13px] focus:ring-ring"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive shrink-0">
                <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
              </svg>
              <p className="text-[12px] text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full h-11 rounded-xl text-[13px] font-medium mt-1 shadow-sm shadow-primary/20" disabled={loading}>
            {loading ? (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/50">
          Acme Engineering &middot; Internal use only
        </p>
      </div>
    </div>
  );
}
