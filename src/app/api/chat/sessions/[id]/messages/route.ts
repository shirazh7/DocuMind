// ── CHAT MESSAGES: LOAD HISTORY FOR A SESSION ──────────────────────────
//
// Returns the ordered message list for a session. The session ID is a
// random UUID that functions as a bearer token — knowing it grants read
// access, the same trust model as a shareable link. This is acceptable
// for a demo assistant; a production system would verify the session
// belongs to the authenticated user (join chat_sessions WHERE user_id).
//
// Messages are ordered by sort_order ASC so the client receives them in
// conversation order regardless of insertion timing.
import { NextResponse } from "next/server";
import { loadChatMessages } from "@/lib/chat/persistence";
import { getCurrentUserId } from "@/lib/auth/user-id";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const sql = getDb();

    // Verify the session belongs to this user before returning messages.
    // Uses a lightweight existence check rather than a JOIN in loadChatMessages
    // to keep the persistence layer free of auth concerns.
    const [session] = (await sql`
      SELECT id FROM chat_sessions WHERE id = ${id} AND user_id = ${userId} LIMIT 1
    `) as { id: string }[];

    if (!session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

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

