# Phase 1 — Analysis & Preparation _(2025-10-15)_

## Next.js dependency inventory
- `apps/web/package.json`
	- Core: `next@15.5.0`, `react@19.1.1`, `react-dom@19.1.1`
	- Routing/helpers: `next-themes`, `next/link`, `next/navigation`, `next/script`
	- Types: `@types/node`, `@types/react`, `@types/react-dom`
	- Build/runtime scripts: `next dev`, `next build`, `next start`
- Top-level tooling: `turbo`, `bun`, `vitest` (shared across workspaces)

## Next-specific feature audit

### API routes (`apps/web/src/app/api/*`)
- `/api/chat` — streaming chat completion proxy with rate limiting (`chat/route.ts`, `chat-handler.ts`)
- `/api/chat/send` — persists chat messages via oRPC (`chat/send/route.ts`)
- `/api/openrouter/models` — OpenRouter model listing proxy (`openrouter/models/route.ts`)

### Middleware
- `apps/web/src/middleware.ts` — opt-in matcher, returns `NextResponse.next()` stub for SSR/edge compatibility.

### Server components & data loaders
- `app/layout.tsx` — global metadata, `<html>` shell, Provider wrapper.
- `app/page.tsx` — marketing landing page, renders `HeroSection`.
- `app/dashboard/layout.tsx` — authenticated shell, server-fetches chat summaries + injects bootstrap script.
- `app/dashboard/page.tsx` — dashboard landing (chat preview).
- `app/dashboard/chat/[id]/page.tsx` — async loader fetching messages via oRPC.
- `app/dashboard/new/page.tsx` — server-side redirect guard (`next/navigation`).
- `app/auth/**/page.tsx` — auth entry points; `redirect("/auth/sign-in")` and force-dynamic semantics.

### File-based routing map (current Next app)
- `/` → `src/app/page.tsx`
- `/auth` → redirect → `/auth/sign-in`
- `/auth/sign-in` → `src/app/auth/sign-in/page.tsx`
- `/auth/sign-up` → `src/app/auth/sign-up/page.tsx`
- `/dashboard` → layout + index page
- `/dashboard/chat/[id]` → dynamic chat room with server prefetch
- `/dashboard/new` → server redirect
- `/dashboard/settings` → settings surface
- API namespaces as listed above

### Authentication flow touchpoints
- Client: `@openchat/auth/client` hooks (session + sign-in forms) coupled to `next/navigation` for redirects.
- Server: `apps/web/src/lib/auth-server.ts` consumes `next/headers` to forward Better Auth cookies to Bun/Elysia API.
- Guest handling: `apps/web/src/lib/guest.server.ts` (`next/headers` cookie helpers) and shared guest ID utilities.
- Middleware currently bypasses auth (no enforcement) but matcher ensures API pages pass through for potential future policies.

## Replacement dependency mapping (initial plan)

| Next dependency / feature | TanStack Start / Vite replacement | Notes |
| --- | --- | --- |
| `next` runtime & build | `@tanstack/react-start` + `vite` + `@vitejs/plugin-react` | Leverages TanStack Start RC (v1.132.x) with Vite-based build pipeline. |
| App Router file system (`src/app/*`) | TanStack Router file routes (`apps/web/app/routes/*`) | Use `@tanstack/react-router` file-based generators. |
| `next/link`, `next/navigation` | Router `Link`, `redirect`, `useNavigate`, `useRouterState` | Provided via TanStack Router; update navigation and redirects accordingly. |
| `next/server` (`NextResponse`, route handlers) | TanStack Server Routes or Bun/Elysia controllers | Migrate API endpoints into `apps/server` (Elysia) or new TanStack server routes for edge cases. |
| `next/headers`, `cookies()` | Router loader context / server functions | Hydrate auth context via TanStack Start server runtime; fall back to Bun API introspection. |
| `next/script` | TanStack Start `Head` helpers or manual `<script>` injection in root route | Inline bootstrap handled within root route component. |
| `next-themes` | Evaluate compatibility or replace with headless theme switcher | Confirm `next-themes` works in plain React 19; otherwise swap for `@tanstack/react-start` friendly variant. |
| `app/metadata` exports | TanStack `Head` API + Nitro-compatible meta loaders | Rebuild SEO metadata within Start’s root layout. |
| Next CLI scripts | `vite dev`, `vite build`, `tanstack start` CLI | Scripts will be introduced alongside new build pipeline. |

## Tasks completed this phase
- Audited existing Next.js dependencies and feature usage.
- Created `feature/tanstack-migration` branch for the migration workstream.
- Scaffolded initial Vite + TanStack Start configuration (isolated `apps/web/app` workspace) for parallel development.
- Documented dependency replacement strategy for downstream implementation phases.

## Validation
- Phase 1 scoped to analysis + scaffolding; existing Next.js app remains primary entry point.
- No runtime behavior changed yet; tests executed after scaffold to confirm status quo.
