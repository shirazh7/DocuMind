// ── MODEL CONFIGURATION VIA VERCEL AI GATEWAY ─────────────────────────
//
// Models are plain strings (e.g., "openai/gpt-4.1-nano") routed through
// AI Gateway. No provider-specific SDK import needed — the gateway
// handles routing, failover, and logging.
//
// Three models across the cost/quality/capability spectrum:
// - GPT-4.1 Nano:        ~$0.0001/query — handles 90% of simple lookups
// - GPT-4o Mini:         ~$0.0003/query — complex synthesis across docs
// - Claude Sonnet 4.5:   ~$0.02/query   — highest quality; emits reasoning
//                          tokens that the UI surfaces as a collapsible
//                          "Thought" block (like v0). Gated behind the
//                          premium-model-enabled feature flag.
//
// This demonstrates the cost/latency/capability trade-off enterprise
// customers care about. In production, you'd route automatically based on
// query complexity or user tier — a fast classifier decides which model to
// use rather than leaving it to the user.
//
// TODO(production): Fetch costs from a pricing API, not hardcoded.
// Implement cost alerting with monthly/daily budget caps per team.

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  inputPerToken: number;
  outputPerToken: number;
  // When true, the API route injects providerOptions.anthropic.thinking so the
  // model enters its extended-thinking mode and emits reasoning tokens.
  // sendReasoning: true on the stream response then forwards those tokens to
  // the client as part.type === 'reasoning' parts for the "Thought" UI block.
  supportsThinking?: boolean;
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
  // Claude Sonnet 4.5 supports Anthropic's extended thinking feature.
  // supportsThinking: true causes the API route to inject
  // providerOptions.anthropic.thinking = { type: 'enabled', budgetTokens: 8000 }
  // into the streamText call. Without this flag, Claude responds normally with
  // no reasoning tokens even when sendReasoning is set on the stream response.
  // Gated behind the premium-model-enabled Vercel flag.
  "anthropic/claude-sonnet-4.5": {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    description: "Highest quality — shows reasoning trace",
    inputPerToken: 3 / 1_000_000,
    outputPerToken: 15 / 1_000_000,
    supportsThinking: true,
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
