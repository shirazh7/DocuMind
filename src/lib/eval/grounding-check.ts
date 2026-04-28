// PRODUCTION: Replace substring matching with semantic similarity or LLM-as-judge
// evaluation for more robust grounding checks. Consider using a dedicated eval
// framework (e.g., Braintrust, Langsmith) for versioned, regression-tracked evals.

import type { TestCase } from "./test-cases";

export interface GroundingResult {
  passed: boolean;
  score: number;
  matchedFacts: string[];
  missedFacts: string[];
  isDeclineTest: boolean;
  correctlyDeclined?: boolean;
}

// Substring matching is a pragmatic tradeoff: it's fast, deterministic, and
// doesn't cost API credits — important when running 21 test cases per eval.
// The 60% pass threshold below accounts for LLMs paraphrasing expected facts
// (e.g., "GitHub" might appear as "GitHub Enterprise" or be referenced
// indirectly). A stricter threshold would produce false negatives.
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

  // Decline test: verify the model refuses to answer
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

  // Fact-matching test: check which expected facts appear in the response
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

  // Pass if at least 60% of expected facts are present
  const passed = score >= 0.6;

  return {
    passed,
    score,
    matchedFacts,
    missedFacts,
    isDeclineTest: false,
  };
}
