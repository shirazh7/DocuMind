// ── MODEL CONFIGURATION VIA VERCEL AI GATEWAY ─────────────────────────
//
// Models are plain strings (e.g., "openai/gpt-4.1-nano") routed through
// AI Gateway. No provider-specific SDK import needed — the gateway
// handles routing, failover, and logging.
//
// Two models at opposite ends of the cost/quality spectrum:
// - GPT-4.1 Nano: ~$0.0001/query — handles 90% of simple lookups
// - GPT-4o Mini:  ~$0.0003/query — complex synthesis across docs
//
// This demonstrates the cost/latency trade-off enterprise customers care
// about. In production, you'd route automatically based on query
// complexity or user tier — a fast classifier decides which model to use.
//
// PRODUCTION: Fetch costs from a pricing API, not hardcoded.
// Implement cost alerting with monthly/daily budget caps per team.

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  inputPerToken: number;
  outputPerToken: number;
}

export const MODELS: Record<string, ModelConfig> = {
  "openai/gpt-4.1-nano": {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    description: "Cheapest — ideal for simple lookups",
    inputPerToken: 0.1 / 1_000_000,
    outputPerToken: 0.4 / 1_000_000,
  },
  "openai/gpt-4o-mini": {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Better accuracy, still affordable",
    inputPerToken: 0.15 / 1_000_000,
    outputPerToken: 0.6 / 1_000_000,
  },
};

export const DEFAULT_MODEL_ID = "openai/gpt-4.1-nano";

export function getModelCost(modelId: string) {
  const config = MODELS[modelId];
  if (!config) {
    return { inputPerToken: 0, outputPerToken: 0 };
  }
  return {
    inputPerToken: config.inputPerToken,
    outputPerToken: config.outputPerToken,
  };
}

export function getAvailableModels(): ModelConfig[] {
  return Object.values(MODELS);
}
