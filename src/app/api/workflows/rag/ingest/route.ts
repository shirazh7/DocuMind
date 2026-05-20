// ── WORKFLOW TRIGGER: RAG INGEST ────────────────────────────────────────
//
// Fire-and-forget HTTP trigger for ragIngestWorkflow. Returns the Workflow
// run ID immediately — the actual embedding work happens asynchronously in
// the Vercel Workflow runtime, not in this request's execution window.
//
// runtime = "nodejs": required by the Workflow DevKit — the start() call
// initialises the Workflow runtime which needs full Node.js APIs.
//
// No auth guard: this is an internal operator endpoint. In production, add
// a WORKFLOW_TRIGGER_SECRET check or restrict to admin roles. The proxy
// auth cookie provides a first line of defence for now.
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { ragIngestWorkflow } from "@/workflows/rag-ingest";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { force?: boolean };
    const run = await start(ragIngestWorkflow, [Boolean(body.force)]);
    return NextResponse.json({
      ok: true,
      runId: run.runId,
      message: "RAG ingestion workflow started.",
    });
  } catch (error) {
    console.error("[DocuMind] Failed to start ingestion workflow", error);
    return NextResponse.json(
      { error: "Unable to start ingestion workflow." },
      { status: 500 }
    );
  }
}

