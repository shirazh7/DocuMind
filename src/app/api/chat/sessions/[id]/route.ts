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
