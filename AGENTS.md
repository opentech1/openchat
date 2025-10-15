# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by Turborepo + Bun.
- apps/web — Next.js 15 (Tailwind v4, shadcn). Key paths: `src/app`, `src/components`, `src/lib`, `src/utils`.
- apps/server — Bun + Elysia API with oRPC. Key paths: `src/routers`, `src/lib`, `src/db/schema`.
- Env per app (e.g., `apps/server/.env`); web uses `NEXT_PUBLIC_SERVER_URL` to reach the server. Place assets under each app’s `public/`.

## Build, Test, and Development Commands
- Install deps: `bun install`
- Dev (all): `bun dev` — web on `3001`, server on `3000`.
- Dev (scoped): `bun dev:web`, `bun dev:server`
- Build (all): `bun build`
- Type-check: `bun check-types`
- Lint (oxlint): `bun check`
- Database (server): `bun db:push`, `bun db:migrate`, `bun db:generate`, `bun db:studio`

## Coding Style & Naming Conventions
- Language: TypeScript (ES Modules). Indentation: tabs.
- Filenames: kebab-case (e.g., `sign-in-form.tsx`, `context.ts`).
- React components live in `apps/web/src/components`; colocate modules near usage.
- Prefer type-only imports (`import type { Foo } from "..."`).
- Run `bun check` before pushing; fix straightforward warnings.

## Testing Guidelines
- No runner preconfigured. Prefer Vitest or Bun’s test runner when adding tests.
- Co-locate tests as `*.test.ts(x)` or in `__tests__/`, mirroring `src/`.
- Focus on routers, lib utilities, and critical UI logic.

## Commit & Pull Request Guidelines
- Conventional Commits, e.g.: `feat(web): add sign-in form`, `fix(server): handle CORS origin`, `chore: update deps`.
- PRs should include: concise summary, scope (web/server), linked issues, test steps, and UI screenshots/GIFs when applicable.
- Keep PRs small and focused; update docs when behavior changes.

## Security & Configuration Tips
- Server env: `DATABASE_URL`, `CORS_ORIGIN` (e.g., `http://localhost:3001`). Store in `apps/server/.env` and never commit.
- Auth: Better-Auth under `/api/auth`; use HTTPS in production (`SameSite=None; Secure` cookies). For local dev, set `CORS_ORIGIN` to the web URL.
- After editing `apps/server/src/db/schema`, run `bun db:push` and commit generated artifacts if applicable.

## Agent Pitfalls & Checks
- When updating Docker images, copy every workspace directory the runtime needs so container-only commands remain available.
- For CLI scripts invoked inside containers, prefer absolute paths (e.g., `bun run --cwd /app/apps/server …`) and confirm the script file is present after a build.
