# Automatic Convex Deployment Setup - Summary

This document summarizes the automatic deployment setup for OpenChat's Convex backend.

## Files Created/Modified

### New Files

1. **`.github/workflows/deploy-production.yml`** - Main deployment workflow
   - Automatically deploys Convex on main branch push
   - Waits for canary checks before deploying
   - Runs migrations automatically
   - Verifies deployment success

2. **`scripts/run-migrations.ts`** - Migration runner script
   - Runs all database migrations in order
   - Idempotent - safe to run multiple times
   - Includes verification step
   - Can be used locally or in CI

3. **`.github/workflows/README.md`** - Workflow documentation
   - Explains all GitHub Actions workflows
   - Setup instructions for secrets
   - Troubleshooting guide

4. **`docs/deployment.md`** - Complete deployment guide
   - Production deployment process
   - Manual deployment instructions
   - Migration management
   - Monitoring and debugging
   - Best practices

### Modified Files

1. **`package.json`** - Added migration scripts
   - `convex:migrate` - Run all migrations
   - `convex:verify` - Verify data consistency only

2. **`scripts/deploy.ts`** - Updated deployment instructions
   - Added migration step to next steps

## Required Setup

### 1. GitHub Secrets

Add these secrets to your GitHub repository:

#### `CONVEX_DEPLOY_KEY` (Required)

**Where to get it:**

Option A - From Convex Dashboard:
1. Visit https://dashboard.convex.dev/
2. Select deployment: `outgoing-setter-201`
3. Go to Settings → Deploy Keys
4. Generate or copy deploy key
5. Add to GitHub: Settings → Secrets and variables → Actions → New repository secret

Option B - From Vercel (if already configured):
1. Go to your Vercel project settings
2. Find `CONVEX_DEPLOY_KEY` environment variable
3. Copy the value
4. Add to GitHub Secrets

### 2. Verify Existing Secrets

Ensure these secrets already exist (they should from existing setup):
- `CONVEX_URL` - Used by prod-canary workflow

### 3. Test the Deployment

After setting up secrets:

```bash
# Option 1: Test locally first
bun run deploy
bun run convex:migrate
bun run convex:verify

# Option 2: Trigger GitHub Actions
git checkout main
git pull
# Make a small change
git commit -m "test: trigger deployment workflow"
git push origin main
```

Then monitor:
1. Go to GitHub Actions tab
2. Watch "Production Canary" workflow
3. Watch "Deploy to Production" workflow
4. Check logs for any errors

## How It Works

### Deployment Flow

```
Push to main
     │
     ├────────────────────┬──────────────────────┐
     │                    │                      │
     ▼                    ▼                      ▼
prod-canary.yml    Vercel Deploy      wait-for-canary
     │                                           │
     │                                           ▼
     └──────────────────────────────> deploy-production.yml
                                                 │
                                                 ├─ Deploy Convex
                                                 ├─ Run Migrations
                                                 └─ Verify Data
```

### Workflow Steps

1. **Canary Checks** (`prod-canary.yml`):
   - Runs production health checks
   - Validates Convex is operational
   - Must pass before deployment

2. **Deploy Convex** (`deploy-production.yml`):
   - Waits for canary checks to pass
   - Configures production deployment
   - Deploys schema and functions
   - Runs migrations automatically:
     - `initializeStats` - Initialize DB stats
     - `backfillMessageCounts` - Populate message counts
   - Verifies data consistency
   - Logs deployment status

3. **Vercel** (automatic):
   - Deploys web app automatically
   - Uses latest Convex deployment

## Migration Management

### Automatic (Recommended)

Migrations run automatically during deployment. No manual intervention needed.

### Manual Commands

```bash
# Run all migrations
bun run convex:migrate

# Verify data only
bun run convex:verify

# Force re-run migrations
bun run convex:migrate --force
```

### Direct Convex Commands

```bash
cd apps/server

# Run specific migrations
bunx convex run migrations:initializeStats
bunx convex run migrations:backfillMessageCounts
bunx convex run migrations:verifyMessageCounts
bunx convex run migrations:fixMessageCounts
```

## Monitoring

### Check Deployment Status

1. **GitHub Actions**:
   - Repository → Actions tab
   - View workflow runs and logs

2. **Convex Dashboard**:
   - https://dashboard.convex.dev/t/outgoing-setter-201
   - View deployments, logs, and errors

3. **Local Verification**:
   ```bash
   bun run verify:prod
   ```

### Logs

- **Workflow Logs**: GitHub Actions → Workflow run → Job steps
- **Convex Logs**: Dashboard → Logs section
- **Vercel Logs**: Vercel dashboard → Deployment → Runtime logs

## Rollback Plan

If deployment causes issues:

```bash
# 1. Rollback Convex (via dashboard)
open https://dashboard.convex.dev/t/outgoing-setter-201
# Click "Deployments" → Select previous version → "Deploy"

# 2. Rollback Vercel
vercel rollback

# 3. Re-run migrations if needed
bun run convex:migrate
```

## Troubleshooting

### Deployment Fails

**Error: "Invalid deploy key"**
- Solution: Verify `CONVEX_DEPLOY_KEY` in GitHub Secrets
- Check key hasn't expired
- Generate new key from Convex dashboard

**Error: "Canary checks failed"**
- Solution: Check Convex deployment status
- Review canary test logs
- Wait for issues to resolve (workflow retries automatically)

**Error: "Migration failed"**
- Solution: Check migration logs in workflow
- Run manually: `bun run convex:migrate`
- Fix inconsistencies: `cd apps/server && bunx convex run migrations:fixMessageCounts`

### Workflow Not Triggering

- Ensure pushing to `main` branch
- Check Actions tab is enabled
- Verify workflow files exist in `.github/workflows/`
- Check repository Actions permissions

## Security Notes

1. **Never commit secrets** - Always use GitHub Secrets
2. **Rotate deploy keys** - Update periodically
3. **Protected branches** - Require PR reviews for main
4. **Monitor deployments** - Check dashboard after each deployment

## Next Steps

After setup:

1. ✅ Add `CONVEX_DEPLOY_KEY` to GitHub Secrets
2. ✅ Test deployment workflow
3. ✅ Verify migrations run successfully
4. ✅ Update team documentation
5. ✅ Configure branch protection rules (if not already done)
6. ✅ Set up monitoring/alerts

## Documentation

- [GitHub Workflows README](.github/workflows/README.md)
- [Deployment Guide](docs/deployment.md)
- [Convex Documentation](https://docs.convex.dev/production/deployment)

## Support

For issues:
1. Check workflow README and deployment guide
2. Review GitHub Actions logs
3. Check Convex dashboard
4. Contact team if issue persists

---

**Created**: 2025-11-16
**Version**: 1.0
**Status**: Ready for testing
