// ── WORKFLOW TRIGGER: RAG REINDEX ───────────────────────────────────────
//
// Triggers a full force-reindex of all knowledge base documents.
// Also called weekly by the vercel.json cron (Sunday 4am UTC) as a
// scheduled correctness check. Manual trigger when the embedding model
// changes or documents are updated significantly.
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { ragReindexWorkflow } from "@/workflows/rag-reindex";

export const runtime = "nodejs";

export async function POST() {
  try {
    const run = await start(ragReindexWorkflow);
    return NextResponse.json({
      ok: true,
      runId: run.runId,
      message: "RAG reindex workflow started.",
    });
  } catch (error) {
    console.error("[DocuMind] Failed to start reindex workflow", error);
    return NextResponse.json(
      { error: "Unable to start reindex workflow." },
      { status: 500 }
    );
  }
}

