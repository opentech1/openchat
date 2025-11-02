# Self-Hosting OpenChat with Convex Backend

This guide explains how to run OpenChat with a self-hosted Convex backend using Docker.

## Quick Start

### 1. Start the Convex Backend

```bash
docker compose up -d backend dashboard
```

This starts:
- **Convex Backend** at `http://localhost:3210`
- **Convex Dashboard** at `http://localhost:6790`

### 2. Generate Admin Key

Generate an admin key for deploying your Convex functions:

```bash
docker compose exec backend ./generate_admin_key.sh
```

**Save this key!** You'll need it for deploying functions.

### 3. Configure Environment

Create a `.env.local` file and add:

```env
# Convex Self-Hosted Configuration
CONVEX_SELF_HOSTED_URL=http://localhost:3210
CONVEX_SELF_HOSTED_ADMIN_KEY=<your_admin_key_from_step_2>

# For production, use your domain:
# CONVEX_SELF_HOSTED_URL=https://api.osschat.dev
```

### 4. Deploy Convex Functions

Deploy your Convex functions to the backend:

```bash
docker compose run --rm deploy
```

This pushes all functions in `apps/server/convex/` to your self-hosted backend.

### 5. Start the Web App

```bash
docker compose up -d web
```

The app will be available at `http://localhost:3001`.

## Production Deployment (Dokploy)

For production deployment on Dokploy:

### Environment Variables

Set these in Dokploy:

```env
# Required
BETTER_AUTH_SECRET=<generate_with_openssl_rand_-base64_32>
CONVEX_SELF_HOSTED_ADMIN_KEY=<from_generate_admin_key.sh>

# Public URLs (replace with your domains)
NEXT_PUBLIC_CONVEX_URL=https://api.osschat.dev
NEXT_PUBLIC_APP_URL=https://osschat.dev
NEXT_PUBLIC_SITE_URL=https://osschat.dev
NEXT_PUBLIC_SERVER_URL=https://osschat.dev
SITE_URL=https://osschat.dev

# Convex Backend URLs
CONVEX_URL=http://backend:3210
CONVEX_SELF_HOSTED_URL=https://api.osschat.dev
CONVEX_CLOUD_ORIGIN=https://api.osschat.dev
CONVEX_SITE_ORIGIN=https://api.osschat.dev
```

### Deployment Steps

1. **Deploy Backend**: Deploy the `backend` and `dashboard` services
2. **Generate Admin Key**: Run `docker compose exec backend ./generate_admin_key.sh`
3. **Add Admin Key**: Add the admin key to your environment variables
4. **Deploy Functions**: Run `docker compose run --rm deploy`
5. **Deploy Web App**: Deploy the `web` service

## Troubleshooting

### "Cannot prompt for input in non-interactive terminals"

This means the Convex CLI is trying to ask for login. Make sure you've:
1. Generated an admin key (`docker compose exec backend ./generate_admin_key.sh`)
2. Set `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` in your environment

### Web app shows "NEXT_PUBLIC_CONVEX_URL is not configured"

Make sure you:
1. Set `NEXT_PUBLIC_CONVEX_URL` as an environment variable **AND** as a build arg
2. Rebuild the web container: `docker compose build web`

### Dashboard not accessible

The dashboard runs on port 6790 (mapped to container port 6791). Access it at:
- Local: `http://localhost:6790`
- Production: `https://dash.osschat.dev` (configure your reverse proxy)

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Web Browser   │─────▶│   Web Service    │─────▶│  Convex Backend │
│                 │      │  (Next.js)       │      │  (Self-hosted)  │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                                            │
                                                            │
                                                    ┌───────▼───────┐
                                                    │   Dashboard   │
                                                    │ (Port 6790)   │
                                                    └───────────────┘
```

- **Backend**: Stores all data (users, chats, messages, auth sessions) using SQLite by default
- **Dashboard**: Web UI for managing your Convex deployment
- **Web**: Next.js app with better-auth + Convex integration

## Data Persistence

Convex data is stored in a Docker volume named `convex-data`. To backup:

```bash
docker run --rm -v openchat_convex-data:/data -v $(pwd):/backup alpine tar czf /backup/convex-backup.tar.gz -C /data .
```

To restore:

```bash
docker run --rm -v openchat_convex-data:/data -v $(pwd):/backup alpine tar xzf /backup/convex-backup.tar.gz -C /data
```
