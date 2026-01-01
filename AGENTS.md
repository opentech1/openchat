# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by Turborepo + Bun.
- apps/web — TanStack Start (Vite, TanStack Router, Tailwind v4, shadcn). Key paths: `src/routes`, `src/components`, `src/lib`, `src/stores`.
- apps/web-old — Legacy Next.js frontend (deprecated, kept for reference).
- apps/server — Convex backend. Key paths: `convex/`.
- Env per app (e.g., `apps/web/.env.local`); web uses Vite env vars with `VITE_` prefix.

## Build, Test, and Development Commands
- Install deps: `bun install`
- Dev (all): `bun dev` — web on `3000`, Convex on `3210`.
- Dev (scoped): `bun dev:web`, `bun dev:server`
- Build (all): `bun build`
- Type-check: `bun check-types`
- Lint (oxlint): `bun check`

## Coding Style & Naming Conventions
- Language: TypeScript (ES Modules). Indentation: tabs.
- Filenames: kebab-case (e.g., `sign-in.tsx`, `auth-client.ts`).
- React components live in `apps/web/src/components`; colocate modules near usage.
- Prefer type-only imports (`import type { Foo } from "..."`).
- Run `bun check` before pushing; fix straightforward warnings.

## Testing Guidelines
- Vitest configured for unit tests.
- Co-locate tests as `*.test.ts(x)` or in `__tests__/`, mirroring `src/`.
- Focus on Convex functions, lib utilities, and critical UI logic.

## Commit & Pull Request Guidelines
- Conventional Commits, e.g.: `feat(web): add sign-in form`, `fix(server): handle rate limit`, `chore: update deps`.
- PRs should include: concise summary, scope (web/server), linked issues, test steps, and UI screenshots/GIFs when applicable.
- Keep PRs small and focused; update docs when behavior changes.

## Security & Configuration Tips
- Auth: Better Auth with GitHub OAuth, synced to Convex. Sessions stored in cookies.
- Environment variables: Use `VITE_` prefix for client-side vars in TanStack Start.
- Server env: `OPENROUTER_API_KEY`, `VALYU_API_KEY` for AI features. Store in `apps/web/.env.local` and never commit.
- Convex: `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` for backend connection.

## Agent Pitfalls & Checks
- TanStack Start uses Vite, NOT Next.js. Don't use `NEXT_PUBLIC_*` env vars.
- Routes are in `apps/web/src/routes/` using file-based routing (TanStack Router).
- Auth flow: Better Auth -> Convex user sync via `users.ensure` mutation.
- AI providers: OpenRouter for all models, dual mode (OSSChat Cloud free tier + personal BYOK).
