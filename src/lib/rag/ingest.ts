import { syncPersistentStore } from "@/lib/rag/store";

export async function ingestKnowledgeBase(options?: { force?: boolean }) {
  await syncPersistentStore({ force: options?.force ?? false });
  return { ok: true };
}

