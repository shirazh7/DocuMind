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

