"use client";

// ── EVALUATION RUNNER ──────────────────────────────────────────────────
//
// Runs 21 test cases sequentially against the RAG system. Each test hits
// /api/eval (which uses generateText, not streamText — blocking because
// we need the complete response to run grounding checks).
//
// 500ms delay between requests prevents OpenAI rate limiting.
// Results stream in one at a time so the user sees progress.
//
// Summary dashboard shows: accuracy %, pass count, avg latency, and
// category breakdown (deployment, incident-response, api-auth, etc.).
//
// TODO(production): Restrict to admin roles — each run costs API credits.
// Move to CI pipeline (GitHub Actions) for automated regression testing.

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { ModelSelector } from "@/components/chat/model-selector";
import { EvalCard } from "./eval-card";
import { TEST_CASES, type TestCase } from "@/lib/eval/test-cases";
import { checkGrounding, type GroundingResult } from "@/lib/eval/grounding-check";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";

interface EvalResult {
  testCase: TestCase;
  answer: string;
  sources: Array<{
    index: number;
    source: string;
    section: string;
    content: string;
    similarity: number;
  }>;
  latency: number;
  grounding: GroundingResult;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function EvalRunner() {
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);

  const runEvaluation = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);

    const newResults: EvalResult[] = [];

    for (let i = 0; i < TEST_CASES.length; i++) {
      const testCase = TEST_CASES[i];
      setCurrentQuestion(testCase.question);
      setProgress(((i) / TEST_CASES.length) * 100);

      try {
        const response = await fetch("/api/eval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: testCase.question,
            modelId,
          }),
        });

        const data = await response.json();
        const grounding = checkGrounding(testCase, data.answer || "");

        newResults.push({
          testCase,
          answer: data.answer || data.error || "No response",
          sources: data.sources || [],
          latency: data.latency || 0,
          grounding,
        });

        setResults([...newResults]);
      } catch (error) {
        newResults.push({
          testCase,
          answer: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          sources: [],
          latency: 0,
          grounding: {
            passed: false,
            score: 0,
            matchedFacts: [],
            missedFacts: testCase.expectedFacts,
            isDeclineTest: !!testCase.shouldDecline,
          },
        });
        setResults([...newResults]);
      }

      // Rate limit protection: 500ms delay between requests
      if (i < TEST_CASES.length - 1) {
        await delay(500);
      }
    }

    setProgress(100);
    setCurrentQuestion(null);
    setRunning(false);
  }, [modelId]);

  const passCount = results.filter((r) => r.grounding.passed).length;
  const avgLatency =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.latency, 0) / results.length
      : 0;
  const avgScore =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.grounding.score, 0) / results.length
      : 0;

  // Breakdown by category
  const categories = [...new Set(TEST_CASES.map((t) => t.category))];
  const categoryStats = categories.map((cat) => {
    const catResults = results.filter((r) => r.testCase.category === cat);
    const passed = catResults.filter((r) => r.grounding.passed).length;
    return { category: cat, passed, total: catResults.length };
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ModelSelector
            modelId={modelId}
            onModelChange={setModelId}
            disabled={running}
          />
          <Button onClick={runEvaluation} disabled={running} size="sm">
            {running ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5 mr-1.5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Running...
              </>
            ) : (
              "Run Evaluation"
            )}
          </Button>
        </div>
        {results.length > 0 && (
          <span className="text-xs text-muted-foreground font-mono">
            {results.length}/{TEST_CASES.length} completed
          </span>
        )}
      </div>

      {/* Progress */}
      {running && (
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          {currentQuestion && (
            <p className="text-xs text-muted-foreground truncate">
              Testing: {currentQuestion}
            </p>
          )}
        </div>
      )}

      {/* Summary dashboard */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono">
                {Math.round(avgScore * 100)}%
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                Accuracy
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono">
                {passCount}/{results.length}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                Passed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono">
                {(avgLatency / 1000).toFixed(1)}s
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                Avg Latency
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono">
                {TEST_CASES.length}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                Test Cases
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category breakdown */}
      {results.length > 0 && !running && (
        <div className="flex flex-wrap gap-2">
          {categoryStats.map((cat) => (
            <div
              key={cat.category}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs"
            >
              <span className="font-medium capitalize">
                {cat.category.replace("-", " ")}
              </span>
              <span
                className={`font-mono ${
                  cat.passed === cat.total
                    ? "text-emerald-600 dark:text-emerald-400"
                    : cat.passed > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {cat.passed}/{cat.total}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {results.map((result) => (
          <EvalCard
            key={result.testCase.id}
            question={result.testCase.question}
            category={result.testCase.category}
            expectedFacts={result.testCase.expectedFacts}
            answer={result.answer}
            grounding={result.grounding}
            latency={result.latency}
            isDeclineTest={!!result.testCase.shouldDecline}
          />
        ))}
      </div>

      {/* Empty state */}
      {results.length === 0 && !running && (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">
            Run the evaluation to test the RAG system against {TEST_CASES.length}{" "}
            predefined question-answer pairs.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Tests cover all 5 documentation areas plus hallucination checks.
          </p>
        </div>
      )}
    </div>
  );
}
