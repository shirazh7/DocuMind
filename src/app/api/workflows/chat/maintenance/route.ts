// ── WORKFLOW TRIGGER: CHAT MAINTENANCE ─────────────────────────────────
//
// Triggers the daily session pruning job. Called automatically by Vercel's
// cron scheduler (daily 3am UTC via vercel.json). Can also be called
// manually with a custom daysToKeep value for one-off cleanup:
//   POST /api/workflows/chat/maintenance { "daysToKeep": 7 }
//
// Defaults to 30 days if daysToKeep is missing or invalid — same default
// as the workflow itself to avoid confusing split-brain retention policies.
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { chatMaintenanceWorkflow } from "@/workflows/chat-maintenance";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { daysToKeep?: number };
    const daysToKeep =
      typeof body.daysToKeep === "number" && body.daysToKeep > 0
        ? body.daysToKeep
        : 30;

    const run = await start(chatMaintenanceWorkflow, [daysToKeep]);
    return NextResponse.json({
      ok: true,
      runId: run.runId,
      message: "Chat maintenance workflow started.",
    });
  } catch (error) {
    console.error("[DocuMind] Failed to start maintenance workflow", error);
    return NextResponse.json(
      { error: "Unable to start maintenance workflow." },
      { status: 500 }
    );
  }
}

