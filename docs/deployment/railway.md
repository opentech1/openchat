# Railway Deployment

This guide explains how to deploy the OpenChat stack (web, server, Postgres, ElectricSQL) to [Railway](https://railway.app) using config-as-code and the Railway CLI. The deployment relies on four services:

| Service | Purpose | Notes |
| --- | --- | --- |
| `postgres` | Primary Postgres database | Provided via Railway Postgres plugin |
| `electric` | ElectricSQL sync service | Uses the official `electricsql/electric` image |
| `server` | Bun/Elysia API | Built from `docker/server.Dockerfile` |
| `web` | Next.js frontend | Built from `docker/web.Dockerfile` |

## 1. Prerequisites

- Install the Railway CLI (`npm i -g @railway/cli` or `bunx railway --version`).
- Authenticate: `railway login`.
- Ensure the repository is connected to GitHub; Railway will reference the repo for every service.
- (Optional) Create a `production` environment: `railway environment create production`.

## 2. Config-as-code Files

Railway reads a `railway.toml`/`railway.json` file for each service. Because this is a monorepo, we keep service-specific files alongside the code and point Railway to them via the “Config file path” setting.

| Service | Config file | Key settings |
| --- | --- | --- |
| `server` | `apps/server/railway.toml` | Forces Dockerfile builder for `docker/server.Dockerfile`. |
| `web` | `apps/web/railway.toml` | Forces Dockerfile builder for `docker/web.Dockerfile` and sets the root healthcheck. |

After linking the repo to a Railway service, open **Settings → Build & Deploy → Config as code** and set the file path (e.g. `apps/server/railway.toml`). Railway will respect the Docker CMD from the image, so no additional start command is required.

## 3. Provision Services

Run the following from the repo root with the CLI bound to your project (`railway link <project-id>`):

```bash
# Postgres database (managed plugin)
railway add --database postgres --service postgres

# ElectricSQL container using the public image
railway add \
  --image electricsql/electric:1.1.11 \
  --service electric \
  --variables "ELECTRIC_HTTP_PORT=3010" \
  --variables "ELECTRIC__HTTP__HOST=0.0.0.0" \
  --variables "ELECTRIC__PG_PROXY__PORT=5133"

# Bun API (Dockerfile build)
railway add --service server
railway up --service server --detach

# Next.js frontend (Dockerfile build)
railway add --service web
railway up --service web --detach
```

Notes:

- `railway up` deploys the current directory to the active service; ensure you run it after linking the proper service. Subsequent deployments can be triggered either via CLI or GitHub integration.
- For the `electric` service we reuse the upstream Docker image rather than building locally. If you need a custom image, add a Dockerfile and switch the config-as-code to the Dockerfile builder.

## 4. Environment Variables & Linking

Use Railway’s variable templating to keep secrets centralized. Examples assume the active CLI service is `server` unless noted.

### Shared Variables (project-level)

```bash
railway variables set --shared NEXT_PUBLIC_APP_URL=https://ochat.pro
railway variables set --shared NEXT_PUBLIC_SERVER_URL=https://api.ochat.pro
railway variables set --shared NEXT_PUBLIC_ELECTRIC_URL=https://electric.ochat.pro
railway variables set --shared BETTER_AUTH_URL=https://api.ochat.pro
railway variables set --shared CORS_ORIGIN=https://ochat.pro
```

### Postgres credentials

Railway’s Postgres plugin creates `DATABASE_URL` automatically. Reference it from other services using the templating syntax:

```bash
# Server service
railway variables set --service server DATABASE_URL='${{postgres.DATABASE_URL}}'
railway variables set --service server SHADOW_DATABASE_URL='${{postgres.DATABASE_URL}}?schema=openchat_shadow'

# Electric service
railway variables set --service electric DATABASE_URL='${{postgres.DATABASE_URL}}'
railway variables set --service electric SHADOW_DATABASE_URL='${{postgres.DATABASE_URL}}?schema=openchat_shadow'
```

Create the databases once (if the default `openchat` DB is missing, recreate it too):

```bash
railway connect postgres
# inside psql
CREATE DATABASE openchat;
CREATE DATABASE openchat_shadow;
\q
```

### Auth & Electric secrets

Generate strong secrets locally (reusing `bun run generate:secrets --force` is fine) and set them as sealed variables:

```bash
railway variables set --service server BETTER_AUTH_SECRET=<generated>
railway variables set --service server ELECTRIC_GATEKEEPER_SECRET=<generated>
railway variables set --service server ELECTRIC_SECRET=<generated>

railway variables set --service electric ELECTRIC_GATEKEEPER_SECRET=<same-as-server>
railway variables set --service electric PG_PROXY_PASSWORD=<generated>
railway variables set --service electric ELECTRIC_SECRET=<same-as-server>
railway variables set --service server PG_PROXY_PASSWORD='${{electric.PG_PROXY_PASSWORD}}'
```

### Frontend variables

Point the web service at the shared values and the server proxy:

```bash
railway service web
railway variables set NEXT_PUBLIC_APP_URL='${{shared.NEXT_PUBLIC_APP_URL}}'
railway variables set NEXT_PUBLIC_SERVER_URL='${{shared.NEXT_PUBLIC_SERVER_URL}}'
railway variables set NEXT_PUBLIC_ELECTRIC_URL='${{shared.NEXT_PUBLIC_ELECTRIC_URL}}'
```

## 5. Deployment Flow

1. Push changes to `main`. If GitHub integration is enabled for each service, Railway will build using the specified config-as-code file.
2. For manual deploys, run `railway service <name>` followed by `railway up`.
3. Verify logs: `railway logs --since 1h --service server` and `railway logs --service electric`.
4. Apply database migrations: `railway service server && railway run bun run db:push`.

## 6. Troubleshooting Checklist

- **Config file not picked up**: open the service settings and ensure the “Config file” path (e.g. `apps/web/railway.toml`) is set correctly.
- **Electric cannot reach Postgres**: confirm the `electric` service has `DATABASE_URL` templated from `postgres` and that the shadow database exists.
- **Next.js build fails from missing HTTPS URLs**: verify the shared variables include full `https://` origins.
- **Auth sessions invalid**: ensure `BETTER_AUTH_SECRET` and cookie domain (`AUTH_COOKIE_DOMAIN=.ochat.pro`) are set on the server service.

With these files and commands in place, you can version your Railway configuration alongside the repo and reproduce the four-service stack reliably.
