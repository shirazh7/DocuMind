import { Badge } from "@/components/ui/badge";

// ── CONFIDENCE BADGE: GREEN / AMBER / RED ──────────────────────────────
//
// Enterprise customers need trust signals. Green means the retrieved
// chunk reliably contains the answer. Amber means partially relevant.
// Red means the answer may not be reliable — especially important in
// regulated environments where hallucination has real consequences.
//
// text-embedding-3-small cosine similarity scores cluster in the
// 0.25–0.65 range — NOT 0–1 like a percentage. These thresholds were
// tuned empirically against the eval suite: 0.45+ = high, 0.35–0.45 =
// medium, below 0.35 = low.
const HIGH_THRESHOLD = 0.45;
const MEDIUM_THRESHOLD = 0.35;

interface ConfidenceBadgeProps {
  similarity: number;
}

export function ConfidenceBadge({ similarity }: ConfidenceBadgeProps) {
  if (similarity >= HIGH_THRESHOLD) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs"
      >
        High relevance
      </Badge>
    );
  }

  if (similarity >= MEDIUM_THRESHOLD) {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs"
      >
        Medium relevance
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 text-xs"
    >
      Low relevance
    </Badge>
  );
}
