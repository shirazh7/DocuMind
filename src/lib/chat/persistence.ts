// ── CHAT PERSISTENCE: SESSION AND MESSAGE CRUD ─────────────────────────
//
// Stores conversation history in Neon Postgres so sessions survive page
// refreshes, browser restarts, and serverless cold starts.
//
// Key design decisions:
//
// Replace-all write pattern: replaceChatMessages deletes all existing
// messages for a session then re-inserts the full array in one operation.
// This is simpler than diffing and patching individual messages — the AI SDK
// returns the complete message list on each stream completion, so the full
// state is always available. The UNIQUE (session_id, sort_order) constraint
// makes the re-insert idempotent at the DB level.
//
// No transaction: the DELETE + INSERT is not wrapped in a transaction.
// A crash between them would leave the session message-less until the next
// successful stream. For a production chat system, wrap in BEGIN/COMMIT or
// use an upsert-only approach. The window is tiny (< 1ms) for this workload.
//
// Session title — 60 chars: enough to identify a conversation in a sidebar
// without truncating mid-word in most cases. Derived from the first user
// message only when title IS NULL, so manual titles (if added) are preserved.
//
// LIMIT 20 on listChatSessions: caps sidebar rendering cost. Users who
// exceed 20 active sessions can still access older ones by direct URL; a
// pagination UI is a natural next step.
//
// Session ownership: createChatSession and listChatSessions are scoped by
// userId. ensureChatSession does NOT verify userId on conflict — it trusts
// the caller (/api/chat) to have a valid session. deleteChatSession enforces
// ownership with WHERE user_id = $userId.
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db/client";
import { ensureDatabaseSchema } from "@/lib/db/schema";
import type { DocuMindMessage } from "@/lib/ai/types";

interface ChatMessageRow {
  id: string;
  role: string;
  parts: unknown;
  metadata: unknown;
}

interface ChatSessionRow {
  id: string;
  title: string | null;
  updated_at: string;
}

export async function createChatSession(userId: string) {
  await ensureDatabaseSchema();
  const sql = getDb();
  const sessionId = randomUUID();

  await sql`
    INSERT INTO chat_sessions (id, user_id)
    VALUES (${sessionId}, ${userId})
  `;

  return sessionId;
}

/**
 * Returns an existing empty session for the user if one exists, otherwise
 * creates a new one. "Empty" means zero rows in chat_messages for the session.
 * Prevents a new session being created on every "New Chat" click or page
 * refresh before the user sends any message, which would clutter the sidebar.
 */
// Reuse an existing empty session when possible to avoid sidebar clutter from
// repeated "New Chat" clicks or page refreshes before the user sends a message.
// "Empty" means no rows in chat_messages for the session.
export async function createOrReuseEmptyChatSession(userId: string) {
  await ensureDatabaseSchema();
  const sql = getDb();

  const existing = (await sql`
    SELECT s.id
    FROM chat_sessions s
    LEFT JOIN chat_messages m ON m.session_id = s.id
    WHERE s.user_id = ${userId}
    GROUP BY s.id, s.updated_at
    HAVING COUNT(m.id) = 0
    ORDER BY s.updated_at DESC
    LIMIT 1
  `) as { id: string }[];

  if (existing[0]?.id) {
    await sql`
      UPDATE chat_sessions
      SET updated_at = NOW()
      WHERE id = ${existing[0].id}
    `;
    return existing[0].id;
  }

  return createChatSession(userId);
}

/**
 * Idempotent upsert of a chat session. Called before rate limiting in the
 * chat route so the session row exists even if the request is later rejected.
 * Subsequent calls from retries are no-ops (ON CONFLICT DO UPDATE SET
 * updated_at only).
 */
export async function ensureChatSession(sessionId: string, userId: string) {
  await ensureDatabaseSchema();
  const sql = getDb();

  await sql`
    INSERT INTO chat_sessions (id, user_id)
    VALUES (${sessionId}, ${userId})
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
  `;
}

export async function loadChatMessages(sessionId: string): Promise<DocuMindMessage[]> {
  await ensureDatabaseSchema();
  const sql = getDb();

  const rows = (await sql`
    SELECT id, role, parts, metadata
    FROM chat_messages
    WHERE session_id = ${sessionId}
    ORDER BY sort_order ASC
  `) as ChatMessageRow[];

  return rows.map((row) => ({
    id: row.id,
    role: row.role as DocuMindMessage["role"],
    parts: row.parts as DocuMindMessage["parts"],
    metadata: row.metadata as DocuMindMessage["metadata"],
  }));
}

/**
 * Replaces ALL messages for a session (DELETE + bulk INSERT) in a single
 * sequential operation. Called from the chat route's `onFinish` callback
 * with the complete UIMessage[] after the stream finishes.
 *
 * Also auto-derives a session title from the first user message if the
 * session title is still NULL — so new sessions are titled on first send
 * without a separate API call.
 */
export async function replaceChatMessages(
  sessionId: string,
  messages: DocuMindMessage[]
) {
  await ensureDatabaseSchema();
  const sql = getDb();

  await sql`DELETE FROM chat_messages WHERE session_id = ${sessionId}`;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    // AI SDK may return messages with empty/undefined ids (e.g. tool-call parts);
    // generate a stable fallback so the primary key constraint is never violated.
    const messageId = message.id || randomUUID();
    await sql`
      INSERT INTO chat_messages (id, session_id, sort_order, role, parts, metadata)
      VALUES (
        ${messageId},
        ${sessionId},
        ${i},
        ${message.role},
        ${JSON.stringify(message.parts)},
        ${JSON.stringify(message.metadata ?? null)}
      )
    `;
  }

  // Derive a title from the first user message if not yet set
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser) {
    const textPart = firstUser.parts.find(
      (p): p is { type: "text"; text: string } => p.type === "text" && "text" in p
    );
    if (textPart) {
      const title = textPart.text.trim().slice(0, 60) + (textPart.text.length > 60 ? "…" : "");
      await sql`
        UPDATE chat_sessions
        SET title = ${title}, updated_at = NOW()
        WHERE id = ${sessionId} AND title IS NULL
      `;
    } else {
      await sql`UPDATE chat_sessions SET updated_at = NOW() WHERE id = ${sessionId}`;
    }
  } else {
    await sql`UPDATE chat_sessions SET updated_at = NOW() WHERE id = ${sessionId}`;
  }
}

export async function deleteChatSession(sessionId: string, userId: string) {
  await ensureDatabaseSchema();
  const sql = getDb();

  const result = (await sql`
    DELETE FROM chat_sessions
    WHERE id = ${sessionId} AND user_id = ${userId}
    RETURNING id
  `) as { id: string }[];

  return result.length > 0;
}

/**
 * Deletes chat sessions (and their messages via ON DELETE CASCADE) that have
 * not been updated in `daysOld` days. Returns the number of sessions deleted.
 * Called by the chat maintenance Workflow on a daily cron schedule.
 */
export async function pruneStaleChatSessions(daysOld: number) {
  await ensureDatabaseSchema();
  const sql = getDb();

  const [{ count }] = (await sql`
    SELECT COUNT(*)::text AS count
    FROM chat_sessions
    WHERE updated_at < NOW() - (${daysOld} || ' days')::interval
  `) as { count: string }[];

  await sql`
    DELETE FROM chat_sessions
    WHERE updated_at < NOW() - (${daysOld} || ' days')::interval
  `;

  return Number(count);
}

export async function listChatSessions(userId: string) {
  await ensureDatabaseSchema();
  const sql = getDb();

  // Use the stored title when available; fall back to the first user message
  // text so pre-existing sessions with title = NULL still show meaningful labels.
  const rows = (await sql`
    SELECT
      s.id,
      COALESCE(
        s.title,
        LEFT(
          (
            SELECT cm.parts->0->>'text'
            FROM chat_messages cm
            WHERE cm.session_id = s.id
              AND cm.role = 'user'
            ORDER BY cm.sort_order ASC
            LIMIT 1
          ),
          60
        )
      ) AS title,
      s.updated_at::text
    FROM chat_sessions s
    WHERE s.user_id = ${userId}
    ORDER BY s.updated_at DESC
    LIMIT 20
  `) as ChatSessionRow[];

  return rows;
}

