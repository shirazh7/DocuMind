// ── SUGGESTED QUESTIONS (EMPTY STATE) ──────────────────────────────────
//
// Each question maps to a different source document — clicking any one
// exercises the full RAG pipeline end-to-end. They also match eval test
// cases, so any question triggers the full RAG pipeline and returns a
// grounded, cited answer. Doubles as a smoke test.
const SUGGESTIONS = [
  {
    title: "Rollback a failed deployment",
    question: "What is the rollback procedure for a failed deployment?",
  },
  {
    title: "P1 incident escalation",
    question: "What is the escalation path for a P1 incident?",
  },
  {
    title: "Refresh an expired API token",
    question: "How do I refresh an expired API token?",
  },
  {
    title: "Day one engineer setup",
    question: "What tools do new engineers need access to on day one?",
  },
  {
    title: "Database migration approval",
    question: "What is the approval process for database migrations?",
  },
  {
    title: "Managing feature flags",
    question: "How do we manage feature flags at Acme?",
  },
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 gap-10">
      {/* Headline */}
      <div className="text-center space-y-2.5">
        <h2 className="text-[26px] font-semibold tracking-tight text-foreground leading-tight">
          What do you want to know?
        </h2>
        <p className="text-sm text-muted-foreground max-w-[300px] leading-relaxed">
          Answers grounded in Acme Engineering docs, with sources.
        </p>
      </div>

      {/* 2-column prompt grid — v0 style */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-[540px]">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.question}
            onClick={() => onSelect(s.question)}
            className="group flex items-start justify-between gap-3 text-left px-4 py-3.5 rounded-lg border border-border bg-background hover:bg-muted hover:border-foreground/20 transition-all duration-100"
          >
            <span className="text-sm text-foreground/70 group-hover:text-foreground leading-snug transition-colors">
              {s.title}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 mt-0.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors"
            >
              <path d="M7 7h10v10" />
              <path d="M7 17 17 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
