// ── VERCEL PROJECT CONFIGURATION ────────────────────────────────────────
//
// vercel.ts replaces vercel.json with full TypeScript support and type safety.
// The VercelConfig type from @vercel/config/v1 mirrors vercel.json's schema.
//
// Crons:
//   - chat/maintenance: prunes stale Neon chat sessions daily at 3am UTC.
//   - rag/reindex:      full pgvector re-embed of static KB docs weekly
//                       (Sunday 4am UTC) to pick up document changes and
//                       model upgrades without a manual trigger.
//
// Route security:
//   Workflow routes are internal-only — they should only run from Vercel's
//   cron scheduler or an authenticated manual trigger, never from a public
//   browser request. The "mitigate: deny" rule blocks any request to
//   /api/workflows/* that is missing the x-vercel-cron header, which Vercel
//   adds automatically when invoking a cron job.
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  crons: [
    { path: "/api/workflows/chat/maintenance", schedule: "0 3 * * *" },
    { path: "/api/workflows/rag/reindex", schedule: "0 4 * * 0" },
  ],
  routes: [
    {
      src: "/api/workflows/(.*)",
      missing: [{ type: "header", key: "x-vercel-cron" }],
      mitigate: { action: "deny" },
    },
  ],
};
