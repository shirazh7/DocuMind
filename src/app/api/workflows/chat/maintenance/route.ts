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

