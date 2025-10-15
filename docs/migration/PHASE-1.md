# TanStack Start Migration — Phase 1 Report (2025-10-15)

This document captures analysis and preparation work for migrating the Web app from Next.js to TanStack Start.

## 1) Next.js Dependencies in package.json

- apps/web/package.json
  - next@15.5.0
  - react@19.1.1, react-dom@19.1.1
  - next-themes@^0.4.6
  - @types/react, @types/react-dom
  - typedRoutes enabled in next.config.mjs

## 2) Next.js features used in the codebase

- API routes (app router):
  - apps/web/src/app/api/*
    - /api/chat (route.ts + chat-handler.ts with streaming)
    - /api/chat/send (CORS + ORPC server client)
    - /api/openrouter/models (model discovery)

- Server components / server-only utilities:
  - Uses the App Router. Files under `apps/web/src/app/**/page.tsx` and `layout.tsx` are server components by default.
  - `apps/web/src/lib/auth-server.ts` uses `next/headers` to access request headers on the server.
  - `apps/web/src/lib/guest.server.ts` uses `next/headers` cookies API.

- Middleware:
  - `apps/web/src/middleware.ts` with `NextResponse.next()`; configured `matcher` to apply to most routes and API.

- File-based routing (App Router):
  - `apps/web/src/app/` contains `layout.tsx`, `page.tsx`, and nested route segments:
    - `/dashboard`, `/dashboard/settings`, `/dashboard/new`, `/dashboard/chat/[id]`
    - `/auth`, `/auth/sign-in`, `/auth/sign-up`
    - `/api/*` endpoints listed above

- Authentication flow:
  - Client-side: `@openchat/auth/client` (Better-Auth client) consumed across components (e.g. `authClient.useSession()`).
  - Server-side: Web app calls the Bun+Elysia API for `/api/auth/get-session` via `apps/web/src/lib/auth-server.ts`.
  - Next.js-specific bits:
    - `next/headers` for accessing headers/cookies on the server.
    - `next/navigation` for `redirect()` and client hooks (`useRouter`, `usePathname`, `useSearchParams`).
    - `next/link` used across UI.

## 3) Branch

- Created `feature/tanstack-migration` to scope all migration work.

## 4) Initial Vite + TanStack Router (TanStack Start) Setup

- New app scaffolded at `apps/web-start` to migrate incrementally without breaking the existing Next.js app.
- Configured Vite with React and TanStack Start plugins.
- Added basic file-based routing using TanStack Router’s file routes (`src/routes/__root.tsx`, `src/routes/index.tsx`).

## 5) Dependency Mapping (Next.js -> TanStack Start)

- Routing & navigation:
  - `next/navigation` (router, pathname, search params) -> `@tanstack/react-router` hooks (`useRouter`, `useLocation`, `useSearch`) and Link components.
  - `next/link` -> `Link` from `@tanstack/react-router`.
  - File-based routes under `app/*` -> File routes under `src/routes/*` using TanStack Router + plugin.

- Server APIs & SSR:
  - Next.js route handlers (`app/api/**/route.ts`) -> Standalone fetch handlers served by Bun/Elysia or server functions/loaders in TanStack Start where applicable.
  - `NextResponse` -> standard `Response` from the Fetch API.
  - `next/headers` cookies/headers -> request access from loader/action/server functions in TanStack Start or via the existing Elysia server endpoints.

- Document head & metadata:
  - `Metadata`, `Viewport` (Next) -> use `@tanstack/react-router` `<Head>` utilities or a head manager like `react-helmet-async` for dynamic tags.

- Images & static assets:
  - `next/image` (not used directly here) -> native `<img>` or an alternative (e.g., `unpic/react`) as needed.

- Styling & theming:
  - `next-themes` can remain; it works with React apps (no Next.js requirement).

- Data fetching & state:
  - Continue using `@tanstack/react-query` for client fetching.
  - oRPC + Elysia server remains the backend; the client stays via `@orpc/client`.

Notes:
- TanStack Start package entrypoints and vite plugin come from `@tanstack/react-start` and `@tanstack/router-plugin` (see upstream docs for exact versions and usage).

## Risks / Critical Paths

- Auth integration points (`@openchat/auth`) across client/server.
- Real-time chat transport and CORS between web and server.
- SSR parity for initial page render.
- Route protection and guards.

## Next

- Flesh out SSR config and dev server for `web-start`.
- Begin routing migration for `/auth`, `/dashboard`, and dynamic `/dashboard/chat/[id]`.

