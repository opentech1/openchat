# Dokploy Deployment Guide

This guide documents the production layout we ship with the repository. The
stack runs four containers:

| Service   | Container name       | Responsibility                          |
|-----------|----------------------|-----------------------------------------|
| Postgres  | `openchat-postgres`  | Primary + shadow databases for Drizzle  |
| Electric  | `openchat-electric`  | ElectricSQL sync & gatekeeper proxy     |
| Server    | `openchat-server`    | Bun + Elysia API + Better Auth          |
| Web (opt) | `openchat-web`       | Next.js frontend (can move to Vercel)   |

The same compose file works locally or on Dokploy. Dokploy injects the
environment variables through its UI; no `.env` files are included in the
repository.

## Required environment variables

Set these on the Dokploy **Environment** tab before deploying. Every variable is
referenced directly in `docker-compose.yml`, so missing values will cause the
deployment to fail fast.

| Variable | Used by | Example | Notes |
|----------|---------|---------|-------|
| `DATABASE_URL` | server, electric | `postgresql://user:password@openchat-postgres:5432/openchat` | Must include the database name (`/openchat`). |
| `SHADOW_DATABASE_URL` | server | `postgresql://user:password@openchat-postgres:5432/openchat_shadow` | For Drizzle migrations. |
| `POSTGRES_USER` | postgres | `openchat` | Should match the credentials encoded in the URLs. |
| `POSTGRES_PASSWORD` | postgres | (strong password) | Same value referenced by the URLs. |
| `POSTGRES_DB` | postgres | `openchat` | Primary database created on first boot. |
| `PG_PROXY_PASSWORD` | electric | output of `openssl rand -base64 48 | tr -d '\n'` | Shared with Electric clients. |
| `ELECTRIC_GATEKEEPER_SECRET` | server, electric | `openssl rand -base64 48 | tr -d '\n'` | Must be identical on both services. |
| `ELECTRIC_SECRET` | electric | `openssl rand -base64 48 | tr -d '\n'` | Private key for Electric SQL. |
| `ELECTRIC_SERVICE_URL` | server, web | `http://openchat-electric:3000` | Internal URL the API/client use. Point to the Traefik HTTPS origin when you enable TLS. |
| `ELECTRIC_INSECURE` | electric, server | `false` | Set `true` only when the service is reachable **only** via plain HTTP inside the Docker network. |
| `BETTER_AUTH_SECRET` | server | `openssl rand -base64 48 | tr -d '\n'` | Session encryption key. |
| `BETTER_AUTH_URL` | server | `https://api.ochat.pro` | Base URL used in auth callbacks. |
| `SERVER_INTERNAL_URL` | server | `https://api.ochat.pro` | Origin the server uses when talking to itself. |
| `CORS_ORIGIN` | server | `https://ochat.pro` | Comma-separated list if multiple origins. |
| `NEXT_PUBLIC_APP_URL` | web | `https://ochat.pro` | Public site URL (omit if hosting web elsewhere). |
| `NEXT_PUBLIC_SERVER_URL` | web | `https://api.ochat.pro` | Public API URL. |
| `NEXT_PUBLIC_ELECTRIC_URL` | web | `https://electric.ochat.pro` | Electric HTTP endpoint exposed publicly. |
| `POSTHOG_API_KEY` | server, web API routes | (PostHog project key) | Required to emit LLM analytics and custom events. |
| `POSTHOG_HOST` | server, web API routes | `https://us.i.posthog.com` | Adjust if you use the EU cloud or a proxy. |
| `NEXT_PUBLIC_POSTHOG_KEY` | web | (public PostHog key) | Enables client analytics + session replay. |
| `NEXT_PUBLIC_POSTHOG_HOST` | web | `https://us.i.posthog.com` | Match the environment you use above. |

Recommended command for secrets:

```bash
openssl rand -base64 48 | tr -d '\n'
```

### Invite-only sign-up

Production sign-up now requires a single-use invite code. Generate codes directly on the Dokploy instance by opening the **Terminal** tab for the server service and running:

```bash
bun run --cwd apps/server invite:generate -- --count 5 --expires 24
```

- `--count` (default `1`) controls how many codes are minted.
- `--expires` (optional) specifies the validity window in hours.
- `--created-by` lets you annotate who generated the batch.

Each code may be redeemed exactly once. The API will reserve the code during sign-up and release it automatically if the flow fails.

### Analytics & session replay

Both the API and the Next.js app use PostHog. Provide the server and client keys listed above; if you skip them, analytics is disabled. Session replay respects the `data-ph-no-capture` attributes we ship, so chat content, titles, and form inputs are masked by default.

## Local development

To run locally with Docker Compose, export the same variables in your shell or
create a private `.env` file (not committed) and run:

```bash
docker compose --env-file .env.dev up --build
```

Because the compose file uses `${VAR:?}` guards, missing values cause Docker
Compose to abort with a helpful error message.

## Deployment flow

1. Push to `main`. Dokploy is configured to rebuild images automatically.
2. Dokploy pulls the repo, builds each service via the provided Dockerfiles, and
   launches the compose stack.
3. Verify:
   - `https://api.ochat.pro/api/__debug/db/ping?debug=1` returns `{ "ok": true }`
   - Electric SQL container remains in `healthy` state.
   - Frontend loads and completes the sign-up flow.

If you host the web app on Vercel, you can disable the `web` service in Dokploy
by removing it from the compose file or leaving it undeployed; the rest of the
stack does not depend on it.
