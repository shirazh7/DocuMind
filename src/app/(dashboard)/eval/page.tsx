// ── EVAL PAGE: GATED BY FEATURE FLAG ───────────────────────────────────
//
// The evaluation suite calls the AI Gateway for every test case.
// At scale this is meaningful spend, so the page is gated behind the
// `eval-suite-enabled` Vercel Flag. Toggle it ON in the Vercel Dashboard
// for the environments where eval should be available (e.g. Development,
// Preview) and keep it OFF in Production unless intentional.
//
// The flag is evaluated server-side so the decision never leaks to the
// client. Users who navigate to /eval when the flag is off see a locked
// state — not a 404 — so the feature is discoverable without being usable.
//
// To enable eval: Vercel Dashboard → Flags → eval-suite-enabled → turn ON
// for the target environment → Review and save.
import { evalSuiteEnabled } from "@/flags";
import { EvalRunner } from "@/components/eval/eval-runner";

export default async function EvalPage() {
  const isEnabled = await evalSuiteEnabled();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            Evaluation Suite
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Test the RAG pipeline against predefined question-answer pairs.
            Measures grounding accuracy, hallucination resistance, and response
            latency across all documentation areas.
          </p>
        </div>

        {isEnabled ? (
          <EvalRunner />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-8 py-12 flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Evaluation Suite is disabled</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                This feature is controlled by a feature flag. Enable{" "}
                <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">eval-suite-enabled</code>{" "}
                in the Vercel Dashboard to activate it for this environment.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
