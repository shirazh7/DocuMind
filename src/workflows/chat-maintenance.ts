// ── CHAT MAINTENANCE WORKFLOW ───────────────────────────────────────────
//
// Prunes stale chat sessions and their cascade-deleted messages from Neon.
// Scheduled daily at 3am UTC via vercel.json cron.
//
// Why 30 days default: balances storage cost against user expectation of
// "long-term" history. Enterprise deployments might want 90–365 days with
// a tiered cold-storage export. The daysToKeep param lets operators adjust
// without a code change by passing it in the cron POST body.
//
// Why this is a Workflow instead of a plain cron function:
// Database operations on large tables can take several seconds. Using a
// Workflow step gives us automatic retries if the Neon connection drops
// mid-delete, and the run result is observable in the Vercel dashboard
// so ops teams can confirm the job ran and see how many sessions were pruned.
//
// Cascade: chat_messages.session_id has ON DELETE CASCADE, so pruning
// sessions also removes all their messages in a single database operation.
import { pruneStaleChatSessions } from "@/lib/chat/persistence";

async function pruneSessionsStep(daysToKeep: number) {
  "use step";
  return pruneStaleChatSessions(daysToKeep);
}

export async function chatMaintenanceWorkflow(daysToKeep = 30) {
  "use workflow";

  const deletedSessions = await pruneSessionsStep(daysToKeep);

  return {
    ok: true,
    deletedSessions,
    completedAt: new Date().toISOString(),
  };
}

