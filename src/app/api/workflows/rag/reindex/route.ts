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

