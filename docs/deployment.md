# OpenChat Deployment Guide

This guide covers deploying OpenChat to production, including both the Convex backend and Next.js web frontend.

## Architecture Overview

OpenChat uses a split deployment strategy:

- **Backend (Convex)**: Deployed via GitHub Actions + Manual scripts
- **Frontend (Next.js)**: Deployed automatically via Vercel
- **Migrations**: Run automatically after Convex deployment

```
┌─────────────────────────────────────────────────┐
│  Push to main branch                            │
└───────────┬─────────────────────────────────────┘
            │
            ├─────────────────────┬─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│ prod-canary.yml     │ │ Vercel           │ │ deploy-prod.yml │
│ Health checks       │ │ Auto-deploy web  │ │ (waits for      │
└─────────┬───────────┘ └──────────────────┘ │  canary)        │
          │                                   └────────┬────────┘
          │                                            │
          ▼                                            ▼
┌─────────────────────┐                    ┌─────────────────────┐
│ Canary passes       │                    │ Deploy Convex       │
└─────────────────────┘                    │ + Run Migrations    │
                                           └─────────────────────┘
```

## Production URLs

- **Convex Deployment**: `https://outgoing-setter-201.convex.cloud`
- **Convex Dashboard**: `https://dashboard.convex.dev/t/outgoing-setter-201`
- **Web App**: Managed by Vercel

## Automatic Deployment (Recommended)

### Prerequisites

1. **GitHub Secrets** configured:
   - `CONVEX_DEPLOY_KEY` - Convex production deploy key
   - `CONVEX_URL` - Production Convex URL (for canary checks)

2. **Vercel** connected to your repository with auto-deploy enabled

### Deployment Process

1. **Merge PR to main**:
   ```bash
   git checkout main
   git pull origin main
   git merge your-feature-branch
   git push origin main
   ```

2. **Monitor workflows**:
   - Go to GitHub Actions tab
   - Watch "Production Canary" workflow
   - Watch "Deploy to Production" workflow
   - Check for any errors or warnings

3. **Verify deployment**:
   ```bash
   # Run canary tests locally
   bun run verify:prod

   # Or check Convex dashboard
   open https://dashboard.convex.dev/t/outgoing-setter-201
   ```

### What Happens Automatically

1. **Health Checks** (`prod-canary.yml`):
   - Validates production is operational
   - Tests Convex connectivity
   - Retries on transient failures

2. **Convex Deployment** (`deploy-production.yml`):
   - Waits for canary checks to pass
   - Deploys Convex schema and functions
   - Runs database migrations automatically
   - Verifies data consistency
   - Logs deployment status

3. **Vercel Deployment**:
   - Automatically triggered on main push
   - Builds and deploys Next.js app
   - Uses latest Convex deployment

## Manual Deployment

### Deploy Convex Only

```bash
# Deploy Convex backend to production
bun run deploy

# Run migrations separately
bun run convex:migrate

# Verify data consistency
bun run convex:verify
```

### Deploy Everything

```bash
# 1. Deploy Convex
bun run deploy

# 2. Run migrations
bun run convex:migrate

# 3. Deploy Vercel (if not auto-deploying)
vercel --prod
```

### Emergency Rollback

If a deployment causes issues:

```bash
# 1. Rollback Convex deployment via dashboard
open https://dashboard.convex.dev/t/outgoing-setter-201
# Click "Deployments" → Select previous version → "Deploy"

# 2. Rollback Vercel deployment
vercel rollback
```

## Database Migrations

Migrations are automatically run during deployment but can also be run manually.

### Available Migrations

1. **initializeStats**: Initialize database statistics counters
2. **backfillMessageCounts**: Populate messageCount fields for existing chats
3. **verifyMessageCounts**: Verify data consistency (read-only)

### Running Migrations

```bash
# Run all pending migrations
bun run convex:migrate

# Verify data consistency only
bun run convex:verify

# Force re-run all migrations
bun run convex:migrate --force
```

### Migration Scripts

Direct Convex CLI commands:

```bash
# From apps/server directory
cd apps/server

# Initialize stats
bunx convex run migrations:initializeStats

# Backfill message counts (skip existing)
bunx convex run migrations:backfillMessageCounts '{"skipExisting": true}'

# Fix inconsistencies
bunx convex run migrations:fixMessageCounts

# Verify data
bunx convex run migrations:verifyMessageCounts
```

## Environment Setup

### Local Development

```bash
# 1. Install dependencies
bun install

# 2. Start Convex dev server
bun run convex:dev

# 3. Start Next.js dev server (in another terminal)
bun run dev:web
```

### Production Configuration

The deployment workflow automatically configures:

```bash
# apps/server/.env.local
CONVEX_DEPLOYMENT=outgoing-setter-201
NEXT_PUBLIC_CONVEX_URL=https://outgoing-setter-201.convex.cloud
```

### Required Secrets

| Secret | Location | Purpose |
|--------|----------|---------|
| `CONVEX_DEPLOY_KEY` | GitHub Secrets | Authenticate Convex deployments |
| `CONVEX_URL` | GitHub Secrets | Production Convex URL for health checks |
| `NEXT_PUBLIC_CONVEX_URL` | Vercel Env | Convex URL for web app |

## Monitoring & Debugging

### Check Deployment Status

```bash
# Run production canary tests
bun run verify:prod

# Check Convex deployment info
cd apps/server
bunx convex env list
```

### View Deployment Logs

1. **GitHub Actions Logs**:
   - Repository → Actions tab
   - Select workflow run
   - Click on job steps for detailed logs

2. **Convex Logs**:
   - [Convex Dashboard](https://dashboard.convex.dev/t/outgoing-setter-201)
   - Navigate to "Logs" section
   - Filter by function/timestamp

3. **Vercel Logs**:
   - Vercel dashboard
   - Select deployment
   - View runtime logs

### Common Issues

#### Migration Failures

**Problem**: Migration fails during deployment

**Solution**:
```bash
# Check migration status in Convex dashboard
# Run migrations manually
bun run convex:migrate

# If data is inconsistent
cd apps/server
bunx convex run migrations:fixMessageCounts
```

#### Deployment Key Errors

**Problem**: "Invalid deploy key" error

**Solution**:
1. Verify `CONVEX_DEPLOY_KEY` is set in GitHub Secrets
2. Check key hasn't expired in Convex dashboard
3. Generate new key if needed:
   - Convex Dashboard → Settings → Deploy Keys
   - Copy new key to GitHub Secrets

#### Canary Check Failures

**Problem**: Production canary checks fail before deployment

**Solution**:
1. Check Convex deployment status in dashboard
2. Review canary test logs for specific errors
3. Verify `CONVEX_URL` secret is correct
4. Wait for issues to resolve (workflow will retry)

## Best Practices

### 1. Always Test Before Merging

```bash
# Run tests
bun test

# Verify build succeeds
bun run verify:build

# Run canary checks against production
bun run verify:prod
```

### 2. Monitor Deployments

- Watch GitHub Actions after pushing to main
- Check Convex dashboard for errors
- Verify Vercel deployment succeeded
- Run smoke tests manually if critical changes

### 3. Use Feature Flags

For risky features, use feature flags instead of rolling back:

```typescript
// In Convex functions
const isFeatureEnabled = await ctx.db
  .query("featureFlags")
  .filter(q => q.eq(q.field("key"), "new-feature"))
  .first();

if (isFeatureEnabled?.enabled) {
  // New behavior
} else {
  // Old behavior
}
```

### 4. Database Migrations

- Always test migrations locally first
- Ensure migrations are idempotent
- Use batch processing for large datasets
- Include rollback plan for data migrations

### 5. Security

- Never commit secrets to git
- Rotate deploy keys regularly
- Use protected branches for main
- Require PR reviews before merging
- Enable branch protection rules

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Database migrations tested locally
- [ ] Feature flags configured (if needed)
- [ ] Breaking changes documented
- [ ] Deployment plan communicated to team
- [ ] Monitoring/alerts configured
- [ ] Rollback plan prepared

After deployment:

- [ ] GitHub Actions workflows completed successfully
- [ ] Convex dashboard shows successful deployment
- [ ] Vercel deployment succeeded
- [ ] Production canary tests pass
- [ ] Smoke tests completed manually
- [ ] Data migrations verified
- [ ] Monitor error rates for 30 minutes
- [ ] Team notified of deployment

## Support

For deployment issues:

1. Check this guide and workflow README
2. Review GitHub Actions logs
3. Check Convex dashboard for backend issues
4. Check Vercel dashboard for frontend issues
5. Contact team if issue persists

## Related Documentation

- [GitHub Workflows README](../.github/workflows/README.md)
- [Convex Documentation](https://docs.convex.dev/)
- [Vercel Documentation](https://vercel.com/docs)
