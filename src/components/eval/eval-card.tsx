import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { GroundingResult } from "@/lib/eval/grounding-check";

interface EvalCardProps {
  question: string;
  category: string;
  expectedFacts: string[];
  answer: string;
  grounding: GroundingResult;
  latency: number;
  isDeclineTest: boolean;
}

export function EvalCard({
  question,
  category,
  expectedFacts,
  answer,
  grounding,
  latency,
  isDeclineTest,
}: EvalCardProps) {
  return (
    <Card
      className={`transition-all ${
        grounding.passed
          ? "border-emerald-500/20"
          : "border-red-500/20"
      }`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
                {category}
              </Badge>
              {isDeclineTest && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0 border-amber-500/30 text-amber-700 dark:text-amber-400">
                  Hallucination Check
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium leading-snug">{question}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-muted-foreground">
              {(latency / 1000).toFixed(1)}s
            </span>
            <Badge
              className={`text-xs ${
                grounding.passed
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
              }`}
              variant="outline"
            >
              {grounding.passed ? "PASS" : "FAIL"}
            </Badge>
          </div>
        </div>

        {/* Expected facts */}
        {!isDeclineTest && expectedFacts.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Expected Facts
            </p>
            <div className="flex flex-wrap gap-1">
              {expectedFacts.map((fact) => (
                <span
                  key={fact}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    grounding.matchedFacts.includes(fact)
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-700 dark:text-red-400"
                  }`}
                >
                  {fact}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Decline test result */}
        {isDeclineTest && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Decline Check
            </p>
            <p className="text-xs text-muted-foreground">
              {grounding.correctlyDeclined
                ? "Model correctly declined to answer (not in docs)"
                : "Model should have declined but provided an answer"}
            </p>
          </div>
        )}

        {/* Score */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono text-muted-foreground">
            Score: {Math.round(grounding.score * 100)}%
          </span>
          {!isDeclineTest && (
            <span className="text-muted-foreground">
              {grounding.matchedFacts.length}/{expectedFacts.length} facts matched
            </span>
          )}
        </div>

        {/* Answer preview */}
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            View full response
          </summary>
          <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
            {answer}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
