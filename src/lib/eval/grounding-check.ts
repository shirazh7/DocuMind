// ── GROUNDING CHECK — INTENTIONALLY SIMPLE & DETERMINISTIC ─────────────
//
// For normal questions: takes the expectedFacts array, checks whether each
// fact appears in the response via case-insensitive substring matching.
// Pass threshold is 60% — accounts for the LLM paraphrasing expected facts
// (e.g., "GitHub" might appear as "GitHub Enterprise").
//
// For hallucination tests: checks the response against 11 decline phrases.
// If any decline phrase is found, the test passes.
//
// Trade-off: substring matching isn't as nuanced as LLM-as-judge. But it's
// deterministic, explainable, and free. I can show an enterprise customer
// exactly what's being tested and exactly why something passed or failed.
// Run it 100 times, same result. No black box in the evaluation.
//
// TODO(production): Layer in LLM-as-judge using generateObject from the AI SDK —
// a second model call assesses whether the response is grounded in the
// retrieved chunks. The deterministic baseline stays as the foundation
// because it's auditable. Use a framework like Braintrust or Langsmith
// for versioned, regression-tracked evals.

import type { TestCase } from "./test-cases";

export interface GroundingResult {
  passed: boolean;
  score: number;
  matchedFacts: string[];
  missedFacts: string[];
  isDeclineTest: boolean;
  correctlyDeclined?: boolean;
}

const DECLINE_PHRASES = [
  "don't have enough information",
  "not enough information",
  "don't have information",
  "cannot find",
  "no relevant information",
  "not in our documentation",
  "not covered in",
  "couldn't find",
  "no information about",
  "not available in the documentation",
  "I'm designed to help with",
];

export function checkGrounding(
  testCase: TestCase,
  answer: string
): GroundingResult {
  const lowerAnswer = answer.toLowerCase();

  if (testCase.shouldDecline) {
    const correctlyDeclined = DECLINE_PHRASES.some((phrase) =>
      lowerAnswer.includes(phrase.toLowerCase())
    );
    return {
      passed: correctlyDeclined,
      score: correctlyDeclined ? 1 : 0,
      matchedFacts: [],
      missedFacts: [],
      isDeclineTest: true,
      correctlyDeclined,
    };
  }

  const matchedFacts: string[] = [];
  const missedFacts: string[] = [];

  for (const fact of testCase.expectedFacts) {
    if (lowerAnswer.includes(fact.toLowerCase())) {
      matchedFacts.push(fact);
    } else {
      missedFacts.push(fact);
    }
  }

  const score =
    testCase.expectedFacts.length > 0
      ? matchedFacts.length / testCase.expectedFacts.length
      : 0;

  const passed = score >= 0.6;

  return {
    passed,
    score,
    matchedFacts,
    missedFacts,
    isDeclineTest: false,
  };
}
