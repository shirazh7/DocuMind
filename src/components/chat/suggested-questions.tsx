// ── SUGGESTED QUESTIONS (EMPTY STATE) ──────────────────────────────────
//
// Each question maps to a different source document — clicking any one
// exercises the full RAG pipeline end-to-end. They also match eval test
// cases, so during a live demo the interviewer immediately sees a
// grounded, cited answer. Doubles as a smoke test.
const SUGGESTIONS = [
  {
    label: "Deployment",
    question: "What is the rollback procedure for a failed deployment?",
  },
  {
    label: "Incidents",
    question: "What is the escalation path for a P1 incident?",
  },
  {
    label: "API Auth",
    question: "How do I refresh an expired API token?",
  },
  {
    label: "Onboarding",
    question: "What tools do new engineers need access to on day one?",
  },
  {
    label: "Database",
    question: "What is the approval process for database migrations?",
  },
  {
    label: "Feature Flags",
    question: "How do we manage feature flags at Acme?",
  },
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 mb-5 px-3 py-1.5 rounded-full border border-border/60 bg-background shadow-sm">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-medium text-muted-foreground tracking-tight">
            Knowledge base ready
          </span>
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight mb-2 text-foreground">
          What would you like to know?
        </h2>
        <p className="text-muted-foreground/70 text-[13px] max-w-sm leading-relaxed">
          Ask anything about Acme Engineering&apos;s internal docs.
          Every answer is sourced and cited.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[480px] w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.question}
            onClick={() => onSelect(s.question)}
            className="group text-left px-4 py-3.5 rounded-2xl border border-border/70 bg-card hover:bg-accent/50 hover:border-primary/20 hover:shadow-sm transition-all duration-150 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          >
            <span className="inline-flex items-center gap-1 mb-1.5 text-[10px] font-semibold tracking-wider uppercase text-primary/60 group-hover:text-primary/80 transition-colors">
              {s.label}
            </span>
            <p className="text-[12.5px] text-foreground/80 leading-snug group-hover:text-foreground transition-colors">
              {s.question}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
