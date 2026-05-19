// ── CHAT SESSION: DELETE ────────────────────────────────────────────────
//
// Deletes a session and all its messages (via ON DELETE CASCADE on the
// chat_messages FK). The DELETE query filters by both id AND user_id,
// so one user can never delete another user's session — even if they know
// the UUID. A 404 is returned for both "not found" and "wrong owner" to
// avoid leaking whether a session ID exists for a different user (same
// response either way prevents enumeration).
import { NextResponse } from "next/server";
import { deleteChatSession } from "@/lib/chat/persistence";
import { getCurrentUserId } from "@/lib/auth/user-id";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const deleted = await deleteChatSession(id, userId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Session not found or does not belong to this user." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DocuMind] Failed to delete chat session", error);
    return NextResponse.json(
      { error: "Unable to delete chat session." },
      { status: 500 }
    );
  }
}
