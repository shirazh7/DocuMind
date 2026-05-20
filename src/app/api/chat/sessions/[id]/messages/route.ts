// ── CHAT MESSAGES: LOAD HISTORY FOR A SESSION ──────────────────────────
//
// Returns the ordered message list for a session. Ownership is verified
// before returning messages: the query checks both id AND user_id so a
// user who somehow obtains another session's UUID cannot read its history
// (IDOR prevention). The auth check lives here rather than in the
// persistence layer so loadChatMessages stays free of auth concerns.
//
// 404 is returned for both "not found" and "wrong owner" to avoid leaking
// whether a given session ID exists.
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

