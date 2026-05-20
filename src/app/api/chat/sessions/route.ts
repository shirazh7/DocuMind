// ── CHAT SESSIONS: LIST AND CREATE ─────────────────────────────────────
//
// GET  — returns the 20 most recently active sessions for the current user,
//        used to populate the sidebar history list.
// POST — reuses the most recent empty session (no messages) when available,
//        otherwise creates a new one, then returns its UUID. The client stores
//        this in localStorage as "documind-session-id" and sends it with
//        every subsequent chat request to maintain conversation continuity.
//
// Sessions are scoped by userId from getCurrentUserId() — the same user
// identity used for rate limiting. This ensures users only see their own
// history, and the DELETE route can safely enforce ownership with a
// WHERE user_id = $userId filter.
//
// Why UUID for session IDs: UUIDs are unguessable, so a session ID acts
// as a bearer token for its own access. This is the same model used by
// temporary share links. Not suitable for regulated data — use signed JWTs.
import { NextResponse } from "next/server";
import {
  createOrReuseEmptyChatSession,
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
    const sessionId = await createOrReuseEmptyChatSession(userId);
    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("[DocuMind] Failed to create chat session", error);
    return NextResponse.json(
      { error: "Unable to create a chat session." },
      { status: 500 }
    );
  }
}

