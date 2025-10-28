# Docker Compose (Next.js + Convex)

This repository now ships a ready-to-run Compose stack for the Next.js web app
and the Convex backend. The stack is meant for self-hosted deployments or for
local smoke tests without installing Bun/Node globally.

## Prerequisites

- Docker 24+
- Docker Compose plugin (ships with Docker Desktop)
- Valid WorkOS + Convex credentials in `apps/web/.env.local` and
  `apps/server/.env.local`

The template environment files are located at:

- `env.web.example` → copy to `apps/web/.env.local`
- `apps/server/.env.example` (create manually if you removed the legacy Bun API)

At a minimum the web container needs:

```dotenv
WORKOS_CLIENT_ID=...
WORKOS_API_KEY=...
WORKOS_COOKIE_PASSWORD=...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3001/auth/callback
CONVEX_URL=http://convex:3210
NEXT_PUBLIC_CONVEX_URL=http://localhost:3210
```

The Convex container accepts whatever additional environment variables your
functions require. They are loaded from `apps/server/.env.local`.

## Usage

```bash
# Build and launch both services
docker compose up --build

# Rebuild only the web image after code changes
docker compose build web

# Clean up containers, networks, and anonymous volumes
docker compose down -v
```

- Web UI: http://localhost:3001
- Convex HTTP endpoint: http://localhost:3210
- Convex dashboard (optional): http://localhost:6790

The compose stack mounts the Convex source directory so hot reload still works
when you edit files locally. For the web container we rely on the production
Next.js build; rebuild the image whenever you change frontend code.

## Container layout

| Service | File                        | Ports     | Command                                      |
|---------|-----------------------------|-----------|----------------------------------------------|
| `web`   | `docker/web.Dockerfile`     | 3001/tcp  | `bun run --cwd apps/web start`               |
| `convex`| `docker/convex.Dockerfile`  | 3210,6790 | `bun x convex dev --hostname 0.0.0.0 --port 3210` |

Environment wiring inside `docker-compose.yml` ensures:

- Server-side Convex calls use the internal hostname `http://convex:3210`
- Client-side (browser) requests go through the published port
  `http://localhost:3210`

Adjust the URLs if you place the containers behind a reverse proxy (e.g. Nginx
or Traefik).

## Tips

- For production, swap `CONVEX_URL`/`NEXT_PUBLIC_CONVEX_URL` with your public
  HTTPS endpoints and secure the Convex service behind your proxy.
- If you do not need the Convex dashboard, remove `6790:6790` from the compose
  file.
- When running behind TLS, make sure WorkOS `NEXT_PUBLIC_WORKOS_REDIRECT_URI`
  points at the public HTTPS origin.
