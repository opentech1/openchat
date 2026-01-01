# Sentry Setup Guide

## Prerequisites

1. Create a Sentry account at https://sentry.io/signup/
2. Create a new project for "Next.js"

## Environment Variables

### Required for Production

Add these to your Dokploy environment variables:

```env
# Get from: https://sentry.io/settings/projects/your-project/keys/
NEXT_PUBLIC_SENTRY_DSN=https://your-key@o0.ingest.sentry.io/0
SENTRY_DSN=https://your-key@o0.ingest.sentry.io/0

# For source map uploads (optional but recommended)
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=your-auth-token
```

### How to Get Sentry Values

1. **DSN**: Go to Settings → Projects → [Your Project] → Client Keys (DSN)
2. **Org/Project**: Visible in your Sentry URL: `https://sentry.io/organizations/{org}/projects/{project}/`
3. **Auth Token**: Go to Settings → Account → API → Auth Tokens → Create New Token
   - Scopes needed: `project:read`, `project:releases`, `org:read`

## Features Enabled

✅ **Error Monitoring**: Automatically captures errors and exceptions
✅ **Performance Monitoring**: Tracks API requests and page loads
✅ **Session Replay**: Records user sessions when errors occur (10% of all sessions, 100% with errors)
✅ **Source Maps**: Uploaded automatically during build for readable stack traces

## Testing Locally

Sentry is disabled in development by default (no DSN configured). To test:

1. Uncomment the Sentry variables in `.env.local`
2. Add your development DSN
3. Restart the dev server
4. Trigger an error and check your Sentry dashboard

## Production Deployment

1. Add all environment variables to Dokploy
2. Redeploy the web service
3. Visit `/monitoring-tunnel` to verify Sentry is working
4. Errors will automatically be reported to your Sentry project

## Configuration

All Sentry configuration is in:
- `apps/web/src/sentry.client.config.ts` - Browser-side
- `apps/web/src/sentry.server.config.ts` - Server-side
- `apps/web/src/sentry.edge.config.ts` - Edge runtime
- `apps/web/next.config.mjs` - Sentry webpack plugin

## Tunnel Route

We've configured `/monitoring` as a tunnel route to bypass ad-blockers. This means browser requests to Sentry go through your Next.js server, improving error capture rate.
