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
    await sql`
      INSERT INTO chat_messages (id, session_id, sort_order, role, parts, metadata)
      VALUES (
        ${message.id},
        ${sessionId},
        ${i},
        ${message.role},
        ${JSON.stringify(message.parts)},
        ${JSON.stringify(message.metadata ?? null)}
      )
    `;
  }

  await sql`
    UPDATE chat_sessions
    SET updated_at = NOW()
    WHERE id = ${sessionId}
  `;
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

  const rows = (await sql`
    SELECT id, title, updated_at::text
    FROM chat_sessions
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 20
  `) as ChatSessionRow[];

  return rows;
}

