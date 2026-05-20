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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"username" | "password" | null>(null);

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
    <>
      <style>{`
        @keyframes bar-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin-slow {
          to { transform: rotate(360deg); }
        }

        .login-card { animation: card-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .spectrum-bar {
          background: linear-gradient(
            90deg,
            #007cf0, #00dfd8, #7928ca, #ff0080, #ff4d4d, #f9cb28, #007cf0
          );
          background-size: 200% 100%;
          animation: bar-shift 6s ease infinite;
        }

        .input-field {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 13px;
          color: rgba(255,255,255,0.9);
          font-family: var(--font-geist-sans), sans-serif;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          outline: none;
        }
        .input-field::placeholder { color: rgba(255,255,255,0.28); }
        .input-field:focus {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.22);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.06);
        }

        .submit-btn {
          width: 100%;
          height: 36px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          font-family: var(--font-geist-sans), sans-serif;
          cursor: pointer;
          border: none;
          position: relative;
          overflow: hidden;
          transition: opacity 0.2s, transform 0.15s;
          background: #fff;
          color: #000;
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      {/* Full-page dark canvas */}
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ── Login card ──────────────────────────────────────────── */}
        <div
          className="login-card"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 340,
            background: "#111111",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Spectrum bar at top of card */}
          <div className="spectrum-bar" style={{ height: 2, width: "100%" }} />

          <div style={{ padding: "28px 24px 24px" }}>

            {/* ── Logo / Branding ─────────────────────────────────── */}
            <div style={{ marginBottom: 28, textAlign: "center" }}>
              {/* dm monogram */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  marginBottom: 14,
                  borderRadius: 8,
                  background: "#fff",
                  color: "#000",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "var(--font-geist-mono), monospace",
                  letterSpacing: "-0.02em",
                  userSelect: "none",
                }}
              >
                dm
              </div>

              <div>
                <h1
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    letterSpacing: "-0.025em",
                    color: "rgba(255,255,255,0.95)",
                    margin: 0,
                    fontFamily: "var(--font-geist-sans), sans-serif",
                  }}
                >
                  DocuMind
                </h1>
                <p
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 3,
                    fontFamily: "var(--font-geist-sans), sans-serif",
                  }}
                >
                  Enterprise Knowledge Assistant
                </p>
              </div>
            </div>

            {/* ── Form ────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label
                  htmlFor="username"
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    color: "rgba(255,255,255,0.45)",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-geist-sans), sans-serif",
                  }}
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="username"
                  required
                  autoFocus
                  autoComplete="username"
                  className="input-field"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label
                  htmlFor="password"
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    color: "rgba(255,255,255,0.45)",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-geist-sans), sans-serif",
                  }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="password"
                  required
                  autoComplete="current-password"
                  className="input-field"
                />
              </div>

              {error && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 7,
                    background: "rgba(255,77,77,0.08)",
                    border: "1px solid rgba(255,77,77,0.18)",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,100,100,0.9)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m15 9-6 6" />
                    <path d="m9 9 6 6" />
                  </svg>
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(255,100,100,0.9)",
                      fontFamily: "var(--font-geist-sans), sans-serif",
                    }}
                  >
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="submit-btn"
                style={{ marginTop: 4 }}
              >
                {loading ? (
                  <svg
                    style={{
                      animation: "spin-slow 0.8s linear infinite",
                      display: "inline-block",
                      width: 14,
                      height: 14,
                    }}
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.2)" strokeWidth="3" />
                    <path d="M4 12a8 8 0 018-8" stroke="#000" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : (
                  "Continue"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 11,
            color: "rgba(255,255,255,0.18)",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-geist-sans), sans-serif",
          }}
        >
          Acme Engineering &middot; Internal use only
        </p>
      </div>
    </>
  );
}
