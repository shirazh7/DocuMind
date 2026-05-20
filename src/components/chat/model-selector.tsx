"use client";

// ── MODEL SELECTOR + COST DISPLAY ──────────────────────────────────────
//
// Dropdown shows available models with descriptions. After each response,
// the estimated cost appears next to the selector — calculated server-side
// from token usage × per-model pricing and streamed via messageMetadata.
// No separate API call for cost data.
//
// TODO(production): Fetch costs dynamically from a pricing API. Display
// accumulated session/monthly cost to admins. Enforce spend limits.

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAvailableModels, type ModelConfig } from "@/lib/ai/models";

interface ModelSelectorProps {
  modelId: string;
  onModelChange: (modelId: string) => void;
  lastCost?: number | null;
  disabled?: boolean;
  // Passed from the server component via ChatInterface; filtered by the
  // premium-model-enabled Vercel Flag. Falls back to all models when not
  // provided (e.g. in the eval runner, which is already flag-gated).
  allowedModels?: ModelConfig[];
}

export function ModelSelector({
  modelId,
  onModelChange,
  lastCost,
  disabled,
  allowedModels,
}: ModelSelectorProps) {
  const models = allowedModels ?? getAvailableModels();
  const currentModel = models.find((m) => m.id === modelId) ?? models[0];

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-mono rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50 tracking-tight text-foreground/70 hover:text-foreground"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {currentModel.name}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {models.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onClick={() => onModelChange(model.id)}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="font-medium text-sm">{model.name}</span>
              <span className="text-xs text-muted-foreground">
                {model.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {lastCost != null && lastCost > 0 && (
        <span className="text-[10px] font-mono text-muted-foreground">
          ~${lastCost.toFixed(4)}
        </span>
      )}
    </div>
  );
}
