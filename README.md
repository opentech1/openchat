# OpenChat

OpenChat is an open-source AI chat workspace that you can self-host or run on OpenChat Cloud. It pairs a streaming Next.js 15 frontend with Convex for persistence and live sync, and ships with WorkOS AuthKit, OpenRouter integration, and a Tailwind v4 + shadcn design system. The monorepo is managed with Turborepo and Bun so the web app, Convex functions, shared packages, and browser extension stay in lockstep.

## Highlights
- Streaming chat UI with optimistic updates, sidebar sync, and attachment awareness backed by Convex message storage.
- WorkOS AuthKit sign-in flow plus helpers for guest fallbacks and session-aware analytics.
- OpenRouter proxy with rate limiting, per-user API key vaulting, and smooth streaming utilities for custom AI model responses.
- Customizable component library built with Tailwind v4, shadcn primitives, and theming helpers for brand-specific deployments.
- Batteries-included observability via PostHog event scaffolding and optional extension surface for in-browser shortcuts.

## Repository Layout
| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js 15 marketing site + authenticated chat workspace (`src/app`, `src/components`, `src/lib`). |
| `apps/server/convex` | Convex functions that persist users, chats, and messages and expose realtime sync topics. |
| `apps/extension` | Browser extension (WXT + React) for quick OpenChat access. |
| `packages/auth` | Reusable Better-Auth layer for Postgres-backed sessions with memory fallbacks. |
| `docs/` | Deployment runbooks (`deployment/`) and deep-dive architecture notes. |
| `scripts/` | Operational scripts such as production canaries and secret generation. |

## Technology Stack
- **Runtime & tooling:** Bun 1.3+, Turborepo, TypeScript (ES modules).
- **Web app:** Next.js 15, React 19, Tailwind CSS v4, shadcn UI, TanStack Query/Form/DB, PostHog.
- **Backend:** Convex data layer (chats, messages, users) with typed client access via `apps/web/src/lib/convex-server.ts`.
- **Auth:** WorkOS AuthKit on the web, Better-Auth package for Postgres + memory fallback.
- **AI models:** OpenRouter provider, smooth streaming helpers, and rate limiting in `apps/web/src/app/api/chat`.
- **Analytics:** PostHog client + server capture via shared helpers (`posthog.md` contains the event plan).

## Quick Start
1. **Install prerequisites**
   - Bun `>= 1.3.0`
   - Node.js `>= 20` (for tooling that shells out to Node)
   - Convex CLI (`bun x convex --version` installs automatically during dev)
2. **Install dependencies**
   ```bash
   bun install
   ```
3. **Configure environment variables**
   - Copy `env.web.example` → `apps/web/.env.local` and fill in WorkOS + Convex + PostHog values.
   - Copy `env.server.example` → `apps/server/.env.local` (Convex picks this up) and supply OpenRouter, Postgres, and analytics secrets as needed.
   - For production overrides, prefer real secrets managers; the templates are meant for local development.
4. **Start local development**
   ```bash
   bun dev
   ```
   The command runs `apps/web` on <http://localhost:3001> and `convex dev` for backend functions.

## Common Tasks
- `bun dev:web` / `bun dev:server` – run a single app.
- `bun check` – lint with Oxlint.
- `bun check-types` – project-wide type checking.
- `bun test` – execute Vitest suites (`apps/web/src/app/api/chat/__tests__` etc.).
- `bun build` – production build for all workspaces.

## Environment Notes
- The chat API reads per-user OpenRouter keys from encrypted storage; without a key chats will prompt for one.
- Rate limiting and streaming behavior is controlled via `OPENROUTER_*` env vars (see `apps/web/src/app/api/chat/chat-handler.ts`).
- WorkOS AuthKit redirects unauthenticated visitors from `/dashboard` to the hosted sign-in page; set `NEXT_PUBLIC_DEV_BYPASS_AUTH=1` to allow local guest flows.
- Convex URLs are mirrored between server (`CONVEX_URL`) and browser (`NEXT_PUBLIC_CONVEX_URL`). When running behind a proxy, ensure both point to TLS origins.

## Deployment
- Docker Compose and Dokploy guides live under `docs/deployment/`. They cover container topology, environment wiring, and production secrets.
- The repository ships `docker/web.Dockerfile` and `docker/convex.Dockerfile` images that are referenced in the compose manifests.
- For bespoke hosting, review `docs/SYNC.md` for websocket expectations and `posthog.md` for analytics instrumentation before scaling out.

## Additional Documentation
- `docs/SYNC.md` – design document for the realtime `/sync` websocket hub.
- `posthog.md` – event naming strategy and dashboards.
- `AGENTS.md` – condensed repo guidelines for automation.

## Contributing & Support
- Read `CONTRIBUTING.md` for coding standards, testing expectations, and PR etiquette.
- Security or conduct issues should follow the guidelines in `CODE_OF_CONDUCT.md`.

## License

OpenChat is licensed under the [GNU Affero General Public License v3](LICENSE).
