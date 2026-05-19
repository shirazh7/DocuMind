// ── CHAT PAGE: FLAG-GATED MODEL LIST ───────────────────────────────────
//
// Evaluates the `premium-model-enabled` flag server-side and passes the
// resulting allowed model list to ChatInterface. Doing this at the page
// level keeps flag evaluation in a server component, where it has access
// to request context (cookies, headers) for targeting rules, and ensures
// the full model registry is never sent to the client unnecessarily.
import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { premiumModelEnabled } from "@/flags";
import { MODELS, DEFAULT_MODEL_ID, type ModelConfig } from "@/lib/ai/models";

export default async function ChatPage() {
  const isPremium = await premiumModelEnabled();

  // Build the allowed model list based on the flag. When OFF, only the
  // default (cheapest) model is available. When ON, all registered models
  // are offered. This mirrors how a tiered SaaS product would gate access
  // to more capable — and more expensive — models.
  const allowedModels: ModelConfig[] = isPremium
    ? Object.values(MODELS)
    : [MODELS[DEFAULT_MODEL_ID]];

  return (
    <Suspense>
      <ChatInterface allowedModels={allowedModels} />
    </Suspense>
  );
}
