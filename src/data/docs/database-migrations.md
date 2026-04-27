# Database Migration Procedures

## Overview

Database migrations at Acme Engineering are treated as critical operations. All schema changes must follow this process to ensure zero downtime, data integrity, and the ability to rollback safely. We use **Prisma** as our ORM and migration tool.

## Migration Workflow

### Step 1: Create the Migration

Generate a new migration from your Prisma schema changes:

```bash
acme db migrate create --name descriptive-migration-name
```

This creates a migration file in `packages/db/prisma/migrations/` with a timestamp prefix.

### Step 2: Review the Migration

Before applying, review the generated SQL:

- Open the migration file in `prisma/migrations/<timestamp>_<name>/migration.sql`
- Verify the SQL is correct and doesn't contain destructive operations
- Check for potential data loss (dropping columns, changing types)
- Ensure indexes are added for new foreign keys

### Step 3: Test on Staging

Apply the migration to the staging environment:

```bash
acme db migrate deploy --env staging
```

After applying:

- Verify the schema change is correct using `acme db status --env staging`
- Run the full integration test suite against staging
- Manually verify affected features in the staging application
- Check query performance for affected tables using `EXPLAIN ANALYZE`

### Step 4: Get Approval

All migrations require the following approvals before production deployment:

1. **PR Review** — at least 2 engineer approvals on the migration PR
2. **DBA Approval** — required for any schema changes affecting tables with more than 1 million rows, index changes, or column type modifications
3. **Tech Lead Sign-off** — for migrations that affect more than 3 tables

Submit a migration request in `#database-changes` Slack channel with:

- Link to the migration PR
- Description of the change
- Impact assessment (tables affected, estimated rows modified)
- Rollback plan

### Step 5: Deploy to Production

Apply the migration during the designated **migration window** (Tuesday and Thursday, 10:00 AM - 12:00 PM UTC):

```bash
acme db migrate deploy --env production
```

Monitor the migration progress in the **Grafana dashboard** at `https://grafana.acme.dev/db-migrations`.

## Zero-Downtime Migration Strategy

### Expand-Contract Pattern

For breaking schema changes, we use the **expand-contract** pattern:

1. **Expand Phase**: Add new columns/tables without removing old ones
   - Add the new column with a default value
   - Deploy application code that writes to both old and new columns
   - Backfill data from old column to new column

2. **Transition Phase**: Switch reads to the new column
   - Update application code to read from the new column
   - Continue writing to both columns for safety

3. **Contract Phase**: Remove the old column (in a separate migration)
   - Stop writing to the old column
   - Drop the old column in a follow-up migration
   - Each phase is a separate PR and deployment

### Example: Renaming a Column

Instead of `ALTER TABLE users RENAME COLUMN name TO full_name`:

```sql
-- Phase 1: Expand
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
UPDATE users SET full_name = name;

-- Phase 2: (deploy code to read/write full_name)

-- Phase 3: Contract (separate migration, deployed later)
ALTER TABLE users DROP COLUMN name;
```

## Rollback Strategy

### Automatic Rollback

If a migration fails during execution:

```bash
acme db rollback
```

This reverts the last applied migration. For rolling back multiple migrations:

```bash
acme db rollback --steps 3
```

### Manual Rollback

For complex rollbacks, write a manual down migration:

1. Create a rollback migration: `acme db migrate create --name rollback-<original-name>`
2. Write the inverse SQL operations
3. Test on staging first
4. Apply to production

### Rollback Limitations

- **Data migrations** (backfills) cannot be automatically rolled back — write explicit down migrations
- **Dropped columns** cannot be recovered — always back up data before dropping
- **Index drops** can be recreated but may take significant time on large tables

## Best Practices

### DO

- Use **nullable columns** with defaults for new required fields (backfill, then add NOT NULL)
- Add **indexes concurrently** using `CREATE INDEX CONCURRENTLY` for tables with > 100K rows
- Include a **down migration** for every up migration
- Test migrations against a **production-size dataset** before deploying
- Schedule large migrations during **low-traffic hours**
- Use **transactions** for data migrations to ensure atomicity

### DON'T

- Never run raw SQL directly on production — always use the migration tool
- Never drop a column without first verifying no application code references it
- Never modify a migration that has already been applied to any environment
- Never bypass the approval process, even for "simple" changes
- Never perform schema changes and data changes in the same migration

## Emergency Procedures

### Stuck Migration

If a migration hangs or takes too long:

1. Check active locks: `SELECT * FROM pg_locks WHERE NOT granted`
2. Identify blocking queries: `SELECT * FROM pg_stat_activity WHERE state = 'active'`
3. If safe, terminate blocking queries: `SELECT pg_terminate_backend(<pid>)`
4. If the migration must be aborted, contact the DBA team immediately in `#database-emergency`

### Data Recovery

In case of accidental data loss:

1. Stop all writes to the affected table immediately
2. Contact the DBA team — they can restore from **point-in-time recovery** (backups are taken every **6 hours** with WAL archiving for continuous recovery)
3. File a P1 incident following the Incident Response Guide
