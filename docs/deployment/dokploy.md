# Dokploy Deployment Guide

This guide documents the production layout we ship with the repository. The
stack runs four containers:

> [!NOTE]
> The Dokploy layout below reflects the legacy Bun/Elysia stack. After the
> Convex migration, the "server" service is replaced by the Convex deployment
> plus the WorkOS AuthKit middleware. We will update this section once the new
> container images are finalized.

| Service   | Container name       | Responsibility                          |
|-----------|----------------------|-----------------------------------------|
| Postgres  | `openchat-postgres`  | Primary + shadow databases for Drizzle  |
| Electric  | `openchat-electric`  | ElectricSQL sync & gatekeeper proxy     |
| Server    | `openchat-server`    | Bun API + WorkOS AuthKit (legacy)       |
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
| `ELECTRIC_SOURCE_ID` | server | `00d41ecf-3020-4ff6-8139-634e7bd44c50` | Copy the Source ID from Electric Cloud (required for `/v1/shape`). |
| `ELECTRIC_SERVICE_URL` | server, web | `http://openchat-electric:3000` | Internal URL the API/client use. Point to the Traefik HTTPS origin when you enable TLS. |
| `ELECTRIC_INSECURE` | electric, server | `false` | Set `true` only when the service is reachable **only** via plain HTTP inside the Docker network. |
| `WORKOS_CLIENT_ID` | web | `client_xxxxx` | WorkOS AuthKit client configured in the dashboard. |
| `WORKOS_API_KEY` | web | `sk_test_xxxxx` | WorkOS API key for server-side middleware. |
| `WORKOS_COOKIE_PASSWORD` | web | `openssl rand -base64 24` | Encrypts the AuthKit session cookie. |
| `SERVER_INTERNAL_URL` | server, web | `http://openchat-server:3000` | Internal origin containers use when calling the API (Traefik can still expose `https://api.ochat.pro` externally). |
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

### Sign-up behaviour

OpenChat now relies on WorkOS AuthKit. Visitors land on `/dashboard` and are redirected to the WorkOS-hosted flow before they can create chats. No invite codes or extra configuration are required beyond setting the WorkOS environment variables above.

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
   - API and web containers report `Ready` in Dokploy logs.
   - Electric SQL container remains in the `running` state.
   - Frontend loads, `/dashboard` opens without errors, and you can send a chat response end-to-end.

If you host the web app on Vercel, you can disable the `web` service in Dokploy
by removing it from the compose file or leaving it undeployed; the rest of the
stack does not depend on it.
