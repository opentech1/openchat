# Contributing to OpenChat

Thanks for helping build OpenChat! This document captures the expectations for setting up your environment, writing code, and getting changes merged.

## Before You Start
- Install **Bun 1.3+** and **Node.js 20+**.
- Install the **Convex CLI** (`bun x convex --help`) and ensure Docker is available if you plan to use the Compose workflow.
- Familiarize yourself with the repository layout in `README.md` and the deeper architecture docs under `docs/`.

## Local Setup
1. Clone the repository and install dependencies:
   ```bash
   bun install
   ```
2. Copy environment templates and fill in secrets:
   - `env.web.example` → `apps/web/.env.local`
   - `env.server.example` → `apps/server/.env.local`
3. Run the monorepo dev server (only when you are ready to test locally):
   ```bash
   bun dev
   ```
   Use `bun dev:web` or `bun dev:server` to focus on a single workspace.

## Working Branches & Commits
- Create topic branches from `main` (`git pull --rebase` keeps your branch current before pushing).
- Use [Conventional Commit](https://www.conventionalcommits.org/) messages, e.g. `feat(web): add workspace picker` or `fix(server): prevent duplicate chat titles`.
- Keep commits logically scoped; use interactive rebases to clean up history before opening a PR.

## Coding Standards
- TypeScript with ES modules across the repo.
- Tabs for indentation, kebab-case filenames, and React components under `apps/web/src/components`.
- Prefer type-only imports (`import type { Foo } from "..."`) when possible.
- Write clear code; add short comments only when the intent is non-obvious.

## Verification Checklist
Run these commands before pushing:
- `bun check` – Oxlint linting.
- `bun check-types` – type checking across workspaces.
- `bun test` or scoped variants (`bun test:web`, `bun test:server`).
- `bun build` (or `bun verify:build`) to ensure the production build succeeds when you touch build-critical code.
- Update or add tests when behaviour changes, colocated as `*.test.ts(x)`.

## Pull Requests
- Keep PRs focused and link related issues when applicable.
- Include:
  - A concise summary of the change and impacted app(s).
  - Testing notes (commands run, screenshots/GIFs for UI work).
  - Follow-ups or rollout considerations.
- Address automated review feedback before requesting human review. If an AI agent posts findings, resolve them before merging.

## Documentation & Changelogs
- Update `README.md`, `docs/`, or in-app copy when user-facing behaviour changes.
- Add upgrade notes to `docs/deployment/` when deployment steps shift.

## Support & Questions
- Open a GitHub Discussion or Issue for architecture questions.
- For security-sensitive reports, use the private contact information listed in the repository security policy (or email the maintainers directly).

We appreciate every contribution—thanks for helping OpenChat grow!
