# Deployment Runbook

## Overview

All production deployments at Acme Engineering follow a standardized process managed through our CI/CD pipeline. This runbook covers the end-to-end deployment workflow, rollback procedures, and environment configuration.

## CI/CD Pipeline

Our CI/CD pipeline runs on **GitHub Actions** and is defined in `.github/workflows/deploy.yml`. Every push to the `main` branch triggers the following stages:

1. **Lint & Type Check** — runs `npm run lint` and `npm run typecheck`
2. **Unit Tests** — runs `npm run test:unit` with a minimum coverage threshold of 80%
3. **Integration Tests** — runs `npm run test:integration` against a staging database
4. **Build** — creates a production build with `npm run build`
5. **Deploy** — deploys to the target environment using `acme deploy --env production`

The pipeline typically completes in **8-12 minutes**. If any stage fails, the deployment is automatically aborted and the team is notified via the `#deployments` Slack channel.

## Deployment Steps

### Pre-Deployment Checklist

Before deploying, ensure the following:

- [ ] All CI checks are green on the `main` branch
- [ ] The deployment has been approved by at least one code reviewer
- [ ] Feature flags for new features are configured in **LaunchDarkly**
- [ ] Database migrations (if any) have been run on staging and verified
- [ ] The on-call engineer has been notified via `#oncall` Slack channel

### Executing a Deployment

To deploy manually (outside of CI):

```bash
acme deploy --env production --version <git-sha>
```

The deploy command performs the following:

1. Pulls the specified version from the container registry
2. Runs a health check against the new container
3. Gradually shifts traffic using a **canary deployment** strategy (10% → 50% → 100%)
4. Each traffic shift waits **5 minutes** for error rate monitoring
5. If the error rate exceeds **1%** during any phase, the deployment is automatically rolled back

### Health Checks

After deployment, the system verifies:

- **HTTP health endpoint**: `GET /api/health` must return `200 OK` within 3 seconds
- **Database connectivity**: Connection pool must initialize successfully
- **External service dependencies**: All third-party API connections are verified

## Rollback Procedures

If a deployment causes issues after completion:

### Automatic Rollback

The deployment system automatically rolls back if:

- Error rate exceeds **2%** within the first **15 minutes** after deployment
- P95 latency increases by more than **50%** compared to the previous version
- Any health check fails for more than **3 consecutive checks**

### Manual Rollback

To manually rollback to the previous version:

```bash
acme rollback --version <previous-git-sha>
```

To rollback to the last known good version:

```bash
acme rollback --latest-stable
```

After a rollback:

1. Notify the team in `#deployments` with the reason for the rollback
2. Create a post-mortem issue if the rollback was due to a bug
3. Disable any feature flags associated with the failed deployment

## Feature Flags

We use **LaunchDarkly** for feature flag management. All new features must be behind a feature flag before deployment.

### Flag Naming Convention

```
team-name.feature-name.sub-feature
```

Example: `platform.new-dashboard.chart-widget`

### Flag Types

- **Boolean flags**: Simple on/off toggles for features
- **Multivariate flags**: A/B testing with multiple variants
- **Percentage rollouts**: Gradual rollout to a percentage of users

### Emergency Kill Switch

Every critical feature has a kill switch flag prefixed with `kill.`. To disable a feature in an emergency:

```bash
acme flags disable kill.payment-processing
```

## Environment Configuration

### Environment Variables

Environment variables are managed through **Vercel Environment Variables** for each deployment environment:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string for caching | Yes |
| `API_SECRET_KEY` | Secret key for API authentication | Yes |
| `LAUNCHDARKLY_SDK_KEY` | LaunchDarkly SDK key | Yes |
| `SENTRY_DSN` | Sentry error tracking DSN | Yes |
| `NEW_RELIC_LICENSE_KEY` | New Relic monitoring key | No |

### Environment Tiers

- **Development** (`dev`): Connected to dev database, all feature flags enabled
- **Staging** (`staging`): Mirror of production with test data
- **Production** (`production`): Live environment with real user data

Configuration is never hardcoded. All secrets are stored in Vercel's encrypted environment variable store and injected at runtime.
