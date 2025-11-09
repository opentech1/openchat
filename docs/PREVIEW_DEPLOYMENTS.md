# Preview Deployment Setup

This document explains how preview deployments work with Convex and Vercel.

> **Note**: This is a test PR to verify the preview deployment seeding functionality works correctly.

## Overview

Preview deployments automatically:
1. Create a fresh Convex backend for each preview branch
2. Seed the database with a test user
3. Use preview-specific environment variables

## Test Credentials

For all preview deployments, the following test user is automatically created:

- **Email**: `test@example.com`
- **Password**: `test`

## Required Vercel Environment Variables

Ensure the following environment variables are set in your Vercel project settings for the **Preview** environment:

### 1. NEXT_PUBLIC_DEPLOYMENT
- **Environment**: Preview only
- **Value**: `preview`
- **Purpose**: Identifies the deployment as a preview to trigger database seeding

### 2. NEXT_PUBLIC_APP_URL
- **Environment**: Preview only
- **Value**: `https://$VERCEL_URL`
- **Purpose**: Sets the correct callback URL for authentication in preview deployments
- **Note**: `$VERCEL_URL` is a Vercel system variable that gets replaced with the actual preview URL

### 3. CONVEX_DEPLOY_KEY
- **Environment**: Preview only
- **Value**: Your Convex preview deploy key (from Convex Dashboard → Settings → Deploy Keys)
- **Purpose**: Authorizes Vercel to create fresh Convex backends for preview deployments

## How It Works

1. When you create a PR, Vercel triggers a preview deployment
2. The build process detects `NEXT_PUBLIC_DEPLOYMENT=preview`
3. Convex deploy runs with the `--preview-run previewSeed` flag
4. A fresh Convex backend is provisioned
5. The `previewSeed` function automatically creates the test user
6. Your preview deployment is ready to test with `test@example.com` / `test`

## Verifying Setup

To verify your preview deployment setup:

1. Go to [Vercel Environment Variables](https://vercel.com/osschat/openchat-web/settings/environment-variables)
2. Check that `NEXT_PUBLIC_DEPLOYMENT` is set to `preview` for **Preview** environment
3. Check that `NEXT_PUBLIC_APP_URL` is set to `https://$VERCEL_URL` for **Preview** environment
4. Check that `CONVEX_DEPLOY_KEY` is set for **Preview** environment

## Troubleshooting

### "Test user not created"
- Check the Convex deployment logs for the preview backend
- Verify `NEXT_PUBLIC_DEPLOYMENT=preview` is set correctly
- The seed function will skip if not in preview mode

### "Authentication fails in preview"
- Verify `NEXT_PUBLIC_APP_URL=https://$VERCEL_URL` is set for Preview environment
- Check that the preview Convex backend has the correct environment variables

### "Cannot connect to Convex"
- Verify `CONVEX_DEPLOY_KEY` is set for Preview environment
- Check that your Convex deploy key has **Preview** permissions (not just Production)

## Manual User Creation

If automatic seeding fails, you can manually create users by:
1. Navigate to your preview deployment URL
2. Click "Sign Up"
3. Create a new account with any email/password
