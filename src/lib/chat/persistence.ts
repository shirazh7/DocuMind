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

