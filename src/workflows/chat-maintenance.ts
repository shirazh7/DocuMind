import { pruneStaleChatSessions } from "@/lib/chat/persistence";

async function pruneSessionsStep(daysToKeep: number) {
  "use step";
  return pruneStaleChatSessions(daysToKeep);
}

export async function chatMaintenanceWorkflow(daysToKeep = 30) {
  "use workflow";

  const deletedSessions = await pruneSessionsStep(daysToKeep);

  return {
    ok: true,
    deletedSessions,
    completedAt: new Date().toISOString(),
  };
}

