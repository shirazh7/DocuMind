// PRODUCTION: Model costs should be fetched from a pricing API or config service,
// not hardcoded. Implement cost alerting with monthly/daily budget caps per team.
// Consider routing queries to different models based on complexity (simple FAQ → nano,
// complex synthesis → mini/full model) to optimize cost/quality.

// Using Vercel AI Gateway — models are referenced as plain strings (e.g., "openai/gpt-4.1-nano")
// and routed through the gateway. No provider-specific SDK import needed.

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  inputPerToken: number;
  outputPerToken: number;
}

// Two models at opposite ends of the cost/quality spectrum demonstrate the
// tradeoff that enterprise customers care about: GPT-4.1 Nano handles 90% of
// simple lookups at near-zero cost, while GPT-4o Mini handles complex synthesis
// that requires reasoning across multiple document sections. In production,
// you'd route automatically based on query complexity or user tier.
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
