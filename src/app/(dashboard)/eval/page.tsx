import { EvalRunner } from "@/components/eval/eval-runner";

export default function EvalPage() {
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
        <EvalRunner />
      </div>
    </div>
  );
}
