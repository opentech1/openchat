# Environment Configuration Guide

This document provides a comprehensive guide to configuring environment variables for OpenChat.

## Quick Start

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update required variables (see below)

3. Run the app:
   ```bash
   bun dev
   ```

## Environment Variable Categories

### Legend

- ✅ **REQUIRED** - Must be set for the app to work
- 🔧 **REQUIRED (with default)** - Has a default but should be customized for production
- ⚙️  **OPTIONAL** - Can be omitted, has sensible defaults
- 🧪 **DEVELOPMENT ONLY** - Only for local development

## Required Variables

### ✅ Authentication Secret

```bash
BETTER_AUTH_SECRET=your-secret-here
```

**Why it's required:** Used to encrypt session tokens and secure authentication.

**How to generate:**
```bash
openssl rand -base64 32
```

**Default:** `dev-secret` (⚠️  INSECURE - change for production!)

### ✅ Convex URLs

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

**Why it's required:** OpenChat uses Convex for real-time database, auth sessions, and sync.

**How to get:**
- Cloud: Run `bunx convex dev` or check your [Convex dashboard](https://dashboard.convex.dev)
- Self-hosted: Use your Convex instance URL

### 🔧 Public URLs (with defaults)

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

**Why they're important:** Used for OAuth callbacks, CORS, metadata, and auth API routes.

**Defaults:**
- `NEXT_PUBLIC_APP_URL`: `http://localhost:3001`
- `NEXT_PUBLIC_SERVER_URL`: `http://localhost:3000`

**Production example:**
```bash
NEXT_PUBLIC_APP_URL=https://chat.yourdomain.com
NEXT_PUBLIC_SERVER_URL=https://api.yourdomain.com
```

## Optional Variables

### ⚙️  OAuth Providers

At least one OAuth provider is recommended for production.

#### GitHub OAuth (Recommended)

```bash
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

See [OAUTH_SETUP.md](../OAUTH_SETUP.md) for setup instructions.

#### Google OAuth

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### ⚙️  Analytics (PostHog)

```bash
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### ⚙️  Advanced Configuration

```bash
# Server-to-server internal URL (optional)
SERVER_INTERNAL_URL=http://localhost:3000

# better-auth base URL (optional, defaults to SERVER_INTERNAL_URL or NEXT_PUBLIC_SERVER_URL)
BETTER_AUTH_URL=http://localhost:3000

# Cross-subdomain cookie domain (optional, for sharing auth between subdomains)
AUTH_COOKIE_DOMAIN=.yourdomain.com

# Cookie prefix (optional, default: "openchat")
AUTH_COOKIE_PREFIX=openchat
```

### 🧪 Development Only

```bash
# Auth bypass for testing (NEVER use in production!)
NEXT_PUBLIC_DEV_BYPASS_AUTH=0
NEXT_PUBLIC_DEV_USER_ID=dev-user
```

⚠️  **WARNING:** Never set `NEXT_PUBLIC_DEV_BYPASS_AUTH=1` in production!

## Deprecated Variables

The following variables are deprecated and will be removed in a future version. Use `NEXT_PUBLIC_APP_URL` instead:

- ❌ `SITE_URL` - Use `NEXT_PUBLIC_APP_URL`
- ❌ `NEXT_PUBLIC_SITE_URL` - Use `NEXT_PUBLIC_APP_URL`
- ❌ `NEXT_PUBLIC_WEB_URL` - Use `NEXT_PUBLIC_APP_URL`
- ❌ `NEXT_PUBLIC_BASE_URL` - Use `NEXT_PUBLIC_APP_URL`
- ❌ `NEXT_PUBLIC_ORIGIN` - Use `NEXT_PUBLIC_APP_URL`

These are still supported for backwards compatibility but will log warnings.

## Environment Validation

OpenChat automatically validates environment variables on startup using Zod schemas.

### Server-side validation

```typescript
import { validateServerEnv } from "@/lib/env";

const env = validateServerEnv();
// Throws an error if validation fails
```

### Client-side validation

```typescript
import { validateClientEnv } from "@/lib/env";

const env = validateClientEnv();
// Throws an error if validation fails
```

### Manual validation

You can also manually validate specific variables:

```typescript
import { getEnvVar } from "@/lib/env";

// Get with default
const apiUrl = getEnvVar("API_URL", "http://localhost:3000");

// Get required (throws if not set)
const secret = getEnvVar("SECRET");
```

## Docker / Production Deployment

### Docker Compose

Update `docker-compose.yml` environment section:

```yaml
environment:
  BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
  NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost:3001}
  NEXT_PUBLIC_SERVER_URL: ${NEXT_PUBLIC_SERVER_URL:-http://localhost:3000}
  NEXT_PUBLIC_CONVEX_URL: ${NEXT_PUBLIC_CONVEX_URL}
```

### Production Checklist

- [ ] Set `BETTER_AUTH_SECRET` to a strong random value (not `dev-secret`)
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain
- [ ] Set `NEXT_PUBLIC_SERVER_URL` to your API domain
- [ ] Configure at least one OAuth provider (GitHub/Google)
- [ ] Set `NODE_ENV=production`
- [ ] Remove or set `NEXT_PUBLIC_DEV_BYPASS_AUTH=0`
- [ ] Test environment validation on startup

## Troubleshooting

### "Environment validation failed" error

This means required variables are missing or invalid. Check the error message for details:

```
❌ Invalid environment variables:
  - BETTER_AUTH_SECRET: Required
  - NEXT_PUBLIC_CONVEX_URL: Invalid url
```

Fix by setting the missing variables in your `.env.local` file.

### OAuth not working

Check:
1. OAuth provider credentials are set correctly
2. Callback URLs match your `NEXT_PUBLIC_APP_URL`
3. See [OAUTH_SETUP.md](../OAUTH_SETUP.md) for detailed setup

### CORS errors

Ensure:
1. `NEXT_PUBLIC_APP_URL` matches your frontend domain exactly
2. No trailing slashes in URLs
3. Protocol (http/https) is correct

## Reference

See `.env.example` for a complete annotated list of all available variables.
