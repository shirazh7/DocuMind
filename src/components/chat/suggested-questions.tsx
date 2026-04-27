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
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-border bg-muted/50">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">
            Knowledge base loaded
          </span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          What would you like to know?
        </h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Ask questions about Acme Engineering&apos;s internal documentation.
          Every answer is grounded in source documents.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.question}
            onClick={() => onSelect(s.question)}
            className="group text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-primary/20 transition-all duration-150"
          >
            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/60 group-hover:text-primary/80">
              {s.label}
            </span>
            <p className="text-sm text-foreground mt-0.5 leading-snug">
              {s.question}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
