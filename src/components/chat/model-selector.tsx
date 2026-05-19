"use client";

// ── MODEL SELECTOR + COST DISPLAY ──────────────────────────────────────
//
// Dropdown shows available models with descriptions. After each response,
// the estimated cost appears next to the selector — calculated server-side
// from token usage × per-model pricing and streamed via messageMetadata.
// No separate API call for cost data.
//
// PRODUCTION: Fetch costs dynamically from a pricing API. Display
// accumulated session/monthly cost to admins. Enforce spend limits.

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAvailableModels } from "@/lib/ai/models";

interface ModelSelectorProps {
  modelId: string;
  onModelChange: (modelId: string) => void;
  lastCost?: number | null;
  disabled?: boolean;
}

const models = getAvailableModels();

export function ModelSelector({
  modelId,
  onModelChange,
  lastCost,
  disabled,
}: ModelSelectorProps) {
  const currentModel = models.find((m) => m.id === modelId) ?? models[0];

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className="inline-flex items-center gap-1.5 h-6 px-2.5 text-[11px] font-mono rounded-lg border border-border/60 bg-background hover:bg-accent transition-colors disabled:opacity-50 tracking-tight"
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
