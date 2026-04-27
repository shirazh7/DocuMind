export const KNOWLEDGE_BASE_DOCS = [
  {
    slug: "deployment-runbook",
    title: "Deployment Runbook",
    icon: "rocket" as const,
    description: "CI/CD pipeline, deployment steps, rollback procedures, feature flags, and environment configuration.",
  },
  {
    slug: "incident-response",
    title: "Incident Response Guide",
    icon: "alert" as const,
    description: "Severity levels (P1–P4), on-call rotation, escalation paths, communication templates, and post-mortems.",
  },
  {
    slug: "api-auth-guide",
    title: "API Authentication Guide",
    icon: "key" as const,
    description: "OAuth 2.0 flow, API key management, rate limiting policies, token refresh, and RBAC roles.",
  },
  {
    slug: "onboarding-checklist",
    title: "New Engineer Onboarding Checklist",
    icon: "users" as const,
    description: "First two weeks tasks, access provisioning, tool setup, key contacts, and coding standards.",
  },
  {
    slug: "database-migrations",
    title: "Database Migration Procedures",
    icon: "database" as const,
    description: "Migration workflow with Prisma, testing requirements, rollback strategy, and zero-downtime procedures.",
  },
] as const;

export type DocIcon = (typeof KNOWLEDGE_BASE_DOCS)[number]["icon"];
