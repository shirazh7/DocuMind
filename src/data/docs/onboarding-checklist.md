# New Engineer Onboarding Checklist

## Overview

Welcome to Acme Engineering! This checklist will guide you through your first two weeks. Your onboarding buddy will help you work through each section. If you get stuck, reach out in the `#new-hires` Slack channel.

## Day 1 — Access & Setup

### Account Access

Request access to the following tools through the IT portal at `https://it.acme.dev/access`:

- [ ] **GitHub** — request access to the `acme-engineering` organization
- [ ] **Slack** — join workspace at `acme-eng.slack.com`, add yourself to `#engineering`, `#new-hires`, `#deployments`, and your team channel
- [ ] **AWS** — request IAM credentials with developer role via IT ticket
- [ ] **Jira** — access the engineering project board at `acme.atlassian.net`
- [ ] **Google Workspace** — email and calendar access (provided by HR)
- [ ] **1Password** — team vault access for shared credentials
- [ ] **Figma** — view access to design files

### Communication

- Introduce yourself in `#engineering` with your name, role, team, and a fun fact
- Schedule a 30-minute coffee chat with your **onboarding buddy** (assigned by your manager)
- Add your manager's weekly 1:1 to your calendar

### Key Contacts

| Role | Name | Slack Handle |
|------|------|-------------|
| Your Manager | See offer letter | Listed in Slack profile |
| Onboarding Buddy | Assigned on Day 1 | Will DM you |
| IT Support | IT Help Desk | `#it-support` |
| HR Contact | People Team | `#people-ops` |
| Engineering Lead | Sarah Chen | `@sarah.chen` |

## Day 2 — Local Development Setup

### Prerequisites

Ensure you have installed:

- **Node.js** v20+ (use `nvm` to manage versions)
- **pnpm** v8+ (our package manager: `npm install -g pnpm`)
- **Docker Desktop** for local services
- **VS Code** with recommended extensions (see `.vscode/extensions.json` in repo)

### Clone & Run

```bash
git clone git@github.com:acme-engineering/acme-web.git
cd acme-web
pnpm install
cp .env.example .env.local
docker compose up -d  # starts PostgreSQL, Redis, and ElasticSearch
pnpm run db:migrate
pnpm run dev
```

The app should be running at `http://localhost:3000`.

### Verify Setup

Run the test suite to confirm everything works:

```bash
pnpm run test:unit
pnpm run test:integration
```

All tests should pass. If you encounter issues, check the **Troubleshooting** section in the repo's README or ask in `#dev-help`.

## Day 3-5 — Learning & Context

### Architecture Overview

Acme's platform is a **monorepo** containing:

- **`apps/web`** — Next.js frontend (App Router, TypeScript)
- **`apps/api`** — Express.js backend API
- **`packages/shared`** — Shared types and utilities
- **`packages/db`** — Prisma schema and database client
- **`packages/ui`** — Shared React component library

We use **PostgreSQL** as our primary database, **Redis** for caching and rate limiting, and **ElasticSearch** for full-text search.

### Required Reading

1. **Architecture Decision Records (ADRs)** — located in `docs/adr/`
2. **API Documentation** — auto-generated at `https://api-docs.acme.dev`
3. **This onboarding guide** you're reading now
4. **Incident Response Guide** — familiarize yourself with P1-P4 severity levels

### Starter Task

Your manager will assign you a **starter task** (tagged `good-first-issue` in Jira). This is intentionally small and well-defined to help you:

- Get familiar with the codebase
- Practice the PR workflow
- Meet team members through code review

## Week 2 — Integration

### Coding Standards

All code at Acme follows these standards:

- **TypeScript** in strict mode (`"strict": true` in `tsconfig.json`)
- **Prettier** for formatting (runs on save in VS Code, enforced in CI)
- **ESLint** with our custom config (`@acme/eslint-config`)
- **Conventional Commits** for commit messages: `feat:`, `fix:`, `chore:`, `docs:`
- **PR Reviews**: Every PR requires at least **2 approvals** before merging
- **Test Coverage**: New code must have at least **80% test coverage**
- **Branch naming**: `feature/JIRA-123-short-description` or `fix/JIRA-456-bug-name`

### PR Workflow

1. Create a branch from `main` following the naming convention
2. Write code with tests
3. Open a PR with a clear description using the PR template
4. Request reviews from at least 2 team members
5. Address review feedback
6. Squash merge to `main` after approval

### Meetings

| Meeting | Frequency | Duration | Purpose |
|---------|-----------|----------|---------|
| Daily Standup | Daily | 15 min | Progress updates, blockers |
| Sprint Planning | Bi-weekly | 1 hour | Plan next sprint |
| Sprint Retro | Bi-weekly | 45 min | Reflect and improve |
| Team Sync | Weekly | 30 min | Technical discussions |
| 1:1 with Manager | Weekly | 30 min | Career growth, feedback |

### 30-Day Checkpoint

At the end of your first month, you'll have a **30-day checkpoint meeting** with your manager to:

- Review your onboarding experience
- Discuss initial impressions and questions
- Set goals for the next quarter
- Identify any training or support needs
