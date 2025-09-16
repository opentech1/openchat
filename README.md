# OpenChat

OpenChat is an open-source AI chat platform template for TypeScript teams. The monorepo pairs a modern Next.js 15 front-end with a Bun + Elysia API, shared contracts via oRPC, and Drizzle/PostgreSQL persistence so you can ship chat experiences fast.

> Built from the Better-T-Stack and tuned for privacy-first, production-ready deployments.

## Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Reference](#environment-reference)
- [Database](#database)
- [Development Workflow](#development-workflow)
- [API & Realtime](#api--realtime)
- [Architecture Notes](#architecture-notes)
- [Testing & Quality](#testing--quality)
- [Deployment Checklist](#deployment-checklist)
- [Troubleshooting](#troubleshooting)
- [Acknowledgements](#acknowledgements)

## Overview

OpenChat gives you a batteries-included chat experience with real authentication, streaming updates, and production-ready ergonomics. Key capabilities include:

- Next.js 15 App Router with Tailwind CSS v4, shadcn/ui primitives, and animated hero experiences.
- Bun-powered tooling, Turborepo workflows, and shared TypeScript contracts across the stack.
- Bun + Elysia API with oRPC endpoints, OpenAPI generation, and secure WebSocket sync channels.
- Drizzle ORM on PostgreSQL, with schema-first migrations and scripts for rapid local setup.
- Clerk authentication wired for both the web app and API, with dev fallbacks for local experimentation.
- Layered security: CORS, per-IP rate limiting, strict response headers, and gzip streaming out of the box.

## Tech Stack

| Area | Technologies | Notes |
| --- | --- | --- |
| Web | Next.js 15, React Server Components, Tailwind CSS 4, shadcn/ui, lucide-react, motion | Lives in `apps/web`, ships the marketing + dashboard experience. |
| API | Bun 1.2 runtime, Elysia, oRPC, WebSockets, Drizzle ORM, PostgreSQL | Lives in `apps/server`, exposes typed RPC + REST + realtime sync. |
| Auth | Clerk (App Router), `@clerk/backend` | Web guarded via middleware, server verifies Bearer tokens with fallbacks for dev. |
| Tooling | Turborepo, Bun scripts, Oxlint, Vitest + V8 coverage | Consistent scripts for dev, build, lint, test, and database lifecycle. |

## Repository Layout

```
apps/
├── web/
│   ├── src/app/            # App Router routes and layout
│   ├── src/components/     # Reusable UI (shadcn + custom animations)
│   ├── src/lib/            # Front-end utilities and data hooks
│   ├── src/utils/          # Shared helpers
│   └── middleware.ts       # Clerk middleware configuration
├── server/
│   ├── src/index.ts        # Elysia bootstrap, oRPC handlers, realtime hub
│   ├── src/routers/        # RPC/router definitions
│   ├── src/lib/            # Context, auth, sync hub helpers
│   ├── src/db/             # Drizzle schema + migrations
│   └── src/__tests__/      # API unit tests (Vitest)
docs/                       # Supplemental documentation and notes
infra/                      # Docker Compose and infra helpers
scripts/                    # Utility scripts (e.g., Dockerised DB bootstrap)
```

## Prerequisites

- [Bun](https://bun.sh/) 1.2.21 or newer (installs dependencies and runs scripts).
- Node.js 18+ (for tooling compatibility) if you prefer `npx`, though Bun covers most workflows.
- Docker Desktop or Podman (optional but recommended) for local PostgreSQL.
- A PostgreSQL 16+ instance (local container, cloud database, or `bun run setup:db`).

## Quick Start

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Configure environment variables**

   Create the following files (see [Environment Reference](#environment-reference) for full descriptions):

   `apps/web/.env.local`
   ```
   NEXT_PUBLIC_SERVER_URL=http://localhost:3000
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...           # needed for server-side helpers
   NEXT_PUBLIC_DEV_BYPASS_AUTH=1          # optional dev bypass toggle
   NEXT_PUBLIC_DEV_USER_ID=dev-user       # matches server dev fallback header
   ```

   `apps/server/.env`
   ```
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/openchat
   CORS_ORIGIN=http://localhost:3001
   PORT=3000
   CLERK_SECRET_KEY=sk_test_...           # same as web secret for token verification
   RATE_LIMIT_PER_MIN=60                  # optional override
   ```

   > Store production secrets outside of version control (`.env*` files are gitignored).

3. **Provision PostgreSQL**

   - Option A: run the bundled Compose stack  
     ```bash
     bun dev:db          # boots infra/dev.docker-compose.yml (postgres:16)
     ```

   - Option B: one-off ephemeral database + `.env.local` writer  
     ```bash
     bun run setup:db
     ```
     This script finds a free port, starts a disposable container, and writes `DATABASE_URL` plus dev auth flags into `.env.local`.

   - Option C: point `DATABASE_URL` at an existing Postgres instance.

4. **Apply the schema**

   ```bash
   bun db:push
   ```

5. **Start everything**

   ```bash
   bun dev
   ```

   - Web app: `http://localhost:3001`
   - API + RPC + realtime hub: `http://localhost:3000`

## Environment Reference

### apps/web

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SERVER_URL` | Yes | Base URL for talking to the Bun API (oRPC + OpenAPI). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for the App Router. |
| `CLERK_SECRET_KEY` | Yes | Used for server components, actions, and API routes that call Clerk. |
| `NEXT_PUBLIC_DEV_BYPASS_AUTH` | Optional | When set, UI enables dev-friendly bypass paths. |
| `NEXT_PUBLIC_DEV_USER_ID` | Optional | Mock user id paired with `NEXT_PUBLIC_DEV_BYPASS_AUTH`. |

### apps/server

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Drizzle. |
| `CORS_ORIGIN` | Yes | Allowed origin for browser requests (defaults to `http://localhost:3001`). |
| `PORT` | Optional | Defaults to `3000`. |
| `CLERK_SECRET_KEY` | Yes for production | Enables verifying Bearer tokens from Clerk. When absent, dev mode trusts `x-user-id`. |
| `RATE_LIMIT_PER_MIN` | Optional | Per-IP request ceiling (defaults to `60`). |

## Database

- Schemas live in `apps/server/src/db/schema`. After editing, run `bun db:push` to sync and commit generated artifacts if required.
- Use `bun db:migrate` once migrations exist, or `bun db:generate` to emit SQL migrations from schema changes.
- `bun db:studio` launches the Drizzle Studio UI against the configured `DATABASE_URL`.
- The sync hub authorises access by checking chat membership in Drizzle, so ensure migrations keep foreign keys intact.

## Development Workflow

- `bun dev` - start web (`3001`) and server (`3000`) together with Turborepo's remote caching support.
- `bun dev:web` / `bun dev:server` - focus on one app at a time.
- `bun build` - production build for every workspace.
- `bun check` - runs Oxlint via Turborepo across the monorepo.
- `bun check-types` - TypeScript type checks (Next.js + Bun + tsconfig references).
- `bun test`, `bun test:web`, `bun test:server`, `bun test:watch` - Vitest suites with coverage support.
- `bun dev:extension`, `bun build:extension` - hooks reserved for the browser extension workspace (scaffolding already wired).

## API & Realtime

- RPC: `POST /rpc/*` via oRPC with automated type inference. The RPC handler shares contracts with the client.
- REST/OpenAPI: `GET/POST /api/*` exposes the same router as JSON:API endpoints, including generated OpenAPI schemas (powered by `@orpc/openapi`).
- Health: `GET /health` and `/` for probe checks.
- Realtime: `ws://localhost:3000/sync` provides topic-based subscriptions. Clients authenticate via Clerk (Bearer token) or dev headers, and can `sub` / `unsub` to topics like `chats:index:{userId}`.
- Security: responses include hardened headers, gzip compression using `CompressionStream`, and a configurable in-memory rate limiter.

## Architecture Notes

- **Front-end (`apps/web`)**
  - Uses the App Router with streaming server components, `HeroSection` animations via `motion/react`, and shadcn/ui components styled by Tailwind v4.
  - Clerk is wired through `middleware.ts` and `layout.tsx`, providing authenticated dashboards while leaving marketing pages public.
  - Utilities under `src/lib` and `src/utils` centralise API clients and formatting helpers.

- **Server (`apps/server`)**
  - Elysia bootstraps RPC + REST + WebSocket handlers, sharing the same `appRouter`.
  - `createContext` bridges Clerk verification and local development headers, making every RPC call aware of the user session.
  - `lib/sync-hub` implements a lightweight topic hub used by the WebSocket endpoint for multi-tab state sync.
  - Drizzle schema modules in `db/schema` define the Postgres data model; `db/index.ts` exports the client.
  - Tests in `src/__tests__` cover routers and helpers with Vitest.

- **Tooling**
  - Turborepo coordinates commands across workspaces and enables incremental builds.
  - `scripts/setup-db.ts` bootstraps disposable Postgres containers and writes helpful `.env` defaults.
  - `infra/dev.docker-compose.yml` gives you a repeatable local database with persistent volumes.

## Testing & Quality

- Run `bun check` before pushing to stay aligned with the linting baseline.
- `bun check-types` ensures the cross-workspace TypeScript project references stay healthy.
- `bun test --coverage` executes Vitest with V8 coverage; CI ready.
- Place new tests alongside the module (`*.test.ts` / `*.test.tsx`) or mirror the structure inside `__tests__/`.
- For new API surface area, add router unit tests under `apps/server/src/__tests__` and extend the shared Zod contracts where possible.

## Deployment Checklist

- Configure production `DATABASE_URL`, `CORS_ORIGIN`, and `NEXT_PUBLIC_SERVER_URL` to reflect deployed domains.
- Set `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to production credentials; ensure HTTPS with `SameSite=None; Secure` cookies.
- Run `bun build` to produce optimized bundles, and `bun db:migrate` against the live database.
- Harden the rate limiting threshold via `RATE_LIMIT_PER_MIN` or swap to a persistent store for distributed rate limiting.
- Front the Bun server with a TLS-terminating proxy (Fly.io, Railway, Vercel Edge, etc.) and forward `x-forwarded-for` headers so rate limiting stays accurate.

## Troubleshooting

- **Ports already in use** - stop lingering processes or adjust `PORT`/Compose port mappings in `apps/server/.env` or `infra/dev.docker-compose.yml`.
- **Auth errors locally** - enable the dev bypass (`NEXT_PUBLIC_DEV_BYPASS_AUTH=1`) and set `NEXT_PUBLIC_DEV_USER_ID`; the API trusts the `x-user-id` header when Clerk secrets are absent.
- **Database connectivity** - confirm `bun dev:db` is running or that `DATABASE_URL` points to a reachable instance. `bun db:studio` is a quick sanity check.
- **Schema drift** - rerun `bun db:generate` and `bun db:push` after editing `apps/server/src/db/schema`, and commit the generated migrations.

## Acknowledgements

- Built on top of [create-better-t-stack](https://github.com/AmanVarshney01/create-better-t-stack).
- UI components borrow from [shadcn/ui](https://ui.shadcn.com/) and [lucide.dev](https://lucide.dev/).
- Powered by [Bun](https://bun.sh/), [Elysia](https://elysiajs.com/), [oRPC](https://orpc.dev/), and [Drizzle ORM](https://orm.drizzle.team/).

