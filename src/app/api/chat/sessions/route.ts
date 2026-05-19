import { NextResponse } from "next/server";
import {
  createChatSession,
  listChatSessions,
} from "@/lib/chat/persistence";
import { getCurrentUserId } from "@/lib/auth/user-id";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const sessions = await listChatSessions(userId);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[DocuMind] Failed to list chat sessions", error);
    return NextResponse.json(
      { error: "Unable to load chat sessions." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const userId = await getCurrentUserId();
    const sessionId = await createChatSession(userId);
    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("[DocuMind] Failed to create chat session", error);
    return NextResponse.json(
      { error: "Unable to create a chat session." },
      { status: 500 }
    );
  }
}

