import { NextResponse } from "next/server";
import { loadChatMessages } from "@/lib/chat/persistence";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await loadChatMessages(id);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[DocuMind] Failed to load chat messages", error);
    return NextResponse.json(
      { error: "Unable to load chat history." },
      { status: 500 }
    );
  }
}

