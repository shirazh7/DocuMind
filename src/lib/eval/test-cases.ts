export interface TestCase {
  id: string;
  question: string;
  expectedFacts: string[];
  category: string;
  shouldDecline?: boolean;
}

export const TEST_CASES: TestCase[] = [
  // Deployment Runbook
  {
    id: "deploy-1",
    question: "What is the rollback procedure for a failed deployment?",
    expectedFacts: [
      "acme rollback",
      "previous version",
      "latest-stable",
      "feature flag",
    ],
    category: "deployment",
  },
  {
    id: "deploy-2",
    question: "What CI/CD pipeline does Acme use and what are the stages?",
    expectedFacts: [
      "GitHub Actions",
      "lint",
      "unit test",
      "integration test",
      "build",
      "deploy",
    ],
    category: "deployment",
  },
  {
    id: "deploy-3",
    question:
      "How does the canary deployment strategy work?",
    expectedFacts: ["10%", "50%", "100%", "5 minutes", "error rate", "1%"],
    category: "deployment",
  },

  // Incident Response
  {
    id: "incident-1",
    question: "What is the escalation path for a P1 incident?",
    expectedFacts: [
      "engineering manager",
      "15 minutes",
      "VP of Engineering",
      "30 minutes",
      "CTO",
    ],
    category: "incident-response",
  },
  {
    id: "incident-2",
    question: "What are the severity levels for incidents at Acme?",
    expectedFacts: ["P1", "P2", "P3", "P4", "critical", "complete service outage"],
    category: "incident-response",
  },
  {
    id: "incident-3",
    question: "What is the post-mortem process after an incident?",
    expectedFacts: [
      "48 hours",
      "5 business days",
      "blameless",
      "5 Whys",
      "action items",
    ],
    category: "incident-response",
  },

  // API Authentication
  {
    id: "auth-1",
    question: "How do I refresh an expired API token?",
    expectedFacts: [
      "refresh token",
      "POST",
      "/auth/refresh",
      "24 hour",
      "client_id",
    ],
    category: "api-auth",
  },
  {
    id: "auth-2",
    question: "What are the rate limiting policies for the API?",
    expectedFacts: [
      "1,000 req/min",
      "100 req/min",
      "429",
      "exponential backoff",
    ],
    category: "api-auth",
  },
  {
    id: "auth-3",
    question: "What RBAC roles are available in the system?",
    expectedFacts: ["Admin", "Developer", "Viewer", "read-only"],
    category: "api-auth",
  },
  {
    id: "auth-4",
    question: "How does the OAuth 2.0 flow work at Acme?",
    expectedFacts: [
      "authorization code",
      "client_id",
      "redirect_uri",
      "access token",
      "refresh token",
    ],
    category: "api-auth",
  },

  // Onboarding
  {
    id: "onboard-1",
    question: "What tools do new engineers need access to on day one?",
    expectedFacts: ["GitHub", "Slack", "AWS", "Jira"],
    category: "onboarding",
  },
  {
    id: "onboard-2",
    question: "What coding standards does Acme follow?",
    expectedFacts: [
      "TypeScript",
      "strict",
      "Prettier",
      "ESLint",
      "Conventional Commits",
    ],
    category: "onboarding",
  },
  {
    id: "onboard-3",
    question:
      "How many approvals are required for a PR at Acme?",
    expectedFacts: ["2 approvals"],
    category: "onboarding",
  },

  // Database Migrations
  {
    id: "db-1",
    question: "What is the approval process for database migrations?",
    expectedFacts: [
      "PR review",
      "DBA approval",
      "staging",
      "Tech Lead",
    ],
    category: "database",
  },
  {
    id: "db-2",
    question:
      "What is the zero-downtime migration strategy?",
    expectedFacts: [
      "expand-contract",
      "add new column",
      "backfill",
      "drop",
    ],
    category: "database",
  },
  {
    id: "db-3",
    question: "How do you rollback a database migration?",
    expectedFacts: ["acme db rollback", "steps", "down migration"],
    category: "database",
  },

  // Hallucination checks — questions not in the docs
  {
    id: "halluc-1",
    question: "What is Acme's policy on remote work?",
    expectedFacts: [],
    shouldDecline: true,
    category: "hallucination-check",
  },
  {
    id: "halluc-2",
    question: "What is the company's stock option vesting schedule?",
    expectedFacts: [],
    shouldDecline: true,
    category: "hallucination-check",
  },
  {
    id: "halluc-3",
    question: "What programming languages does Acme use for mobile development?",
    expectedFacts: [],
    shouldDecline: true,
    category: "hallucination-check",
  },
];
