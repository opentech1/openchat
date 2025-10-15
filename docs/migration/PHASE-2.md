# TanStack Start Migration — Phase 2 (Core Infrastructure)

Status: Initial scaffolding complete; Next.js app remains the primary entrypoint while we migrate features incrementally.

Done
- Added new app `apps/web-start` using Vite + TanStack Router + React Start.
- Base router configured with file routes and dev server on port 3001.
- Introduced `apps/web-start/src/env.ts` to standardize Vite env usage (VITE_* vars).
- Docker: added `docker/web-start.Dockerfile` and a `web_start` service to docker-compose for future cutover.
- Root scripts: `dev:web-start`, `build:web-start` for targeted operations.

Pending / Next
- Wire SSR server entry once routes are migrated and confirm production adapter.
- Set up a Vite proxy to the Bun API for `/rpc` and `/api/auth` to mirror Next.js rewrites.
- Begin incremental route migration for `/auth`, `/dashboard`, and `/dashboard/chat/[id]`.

Notes
- Next.js remains untouched to keep all tests green during the transition.
- We will remove Next-specific config once feature parity is reached.

