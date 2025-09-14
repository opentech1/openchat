# OpenChat – Production Readiness Audit ✅

This document captures non–production‑ready patterns, code smells, and concrete fixes across the monorepo. Emojis indicate severity and help scan issues quickly.

- 🔥 Critical
- ⚠️ High
- 🧩 Medium
- 🪄 Low

---

## TL;DR
- 🔥 Remove conflicting Next rewrite for Clerk and purge legacy Better‑Auth files/routes.
- 🔥 Move all secrets out of `apps/web/.env`; keep only `NEXT_PUBLIC_*` there and fix a malformed line.
- ⚠️ Replace dev‑only header “auth” on the server with real verification; add basic security middleware.
- 🧩 Start using TanStack Query + oRPC in UI where data is fetched.
- 🪄 Polish effects, types, and keys; add security headers in Next.

---

## Web App (Next.js)

### Routing & Auth
- 🔥 Conflicting rewrite with Clerk
  - File: `apps/web/next.config.mjs`
  - Issue: Rewrites `/api/auth/:path*` to the Bun server, which collides with Clerk’s Next routes and breaks flows.
  - Fix: Remove the `/api/auth/:path*` rewrite when using Clerk. Keep only `/rpc/:path*`.

- 🧩 Empty/legacy auth API folder
  - Path: `apps/web/src/app/api/auth/[...path]` (no route handler)
  - Issue: Leftover from a previous auth setup; can shadow or confuse routes.
  - Fix: Remove the folder if not used.

- ⚠️ Dead Better‑Auth client still imported
  - Files: `apps/web/src/lib/auth-client.ts` (throws), used by `components/login-form.tsx`, `components/auth-form.tsx`.
  - Issue: Runtime errors if rendered; mismatched with Clerk.
  - Fix: Remove these components or fully migrate to Clerk equivalents.

### Environment & Secrets
- 🔥 Secrets in client `.env` and malformed line
  - File: `apps/web/.env`
  - Issues:
    - Server secrets present: `CLERK_SECRET_KEY`, `DATABASE_URL`, `SMTP_*`, `GITHUB_CLIENT_SECRET` should not live in the web app.
    - One line is concatenated: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...QCORS_ORIGIN=http://localhost:3001`.
  - Fix:
    - Move all non‑`NEXT_PUBLIC_*` vars to `apps/server/.env`.
    - Keep only `NEXT_PUBLIC_*` in `apps/web/.env`.
    - Normalize line endings and update `.env.example`.

### Data Fetching & State
- ⚠️ TanStack Query is set up but unused
  - Files: `apps/web/src/components/providers.tsx` (QueryClientProvider), `src/utils/orpc.ts` (orpc utils)
  - Issue: No `useQuery`/`useMutation` usage in components; data is called imperatively or not at all.
  - Fix: Use `orpc.<route>.useQuery()`/`useMutation()` in client components. For example, show `privateData` on `/dashboard` with proper loading/error UI.

- 🪄 Effects are UI‑only but can be hardened
  - Files: `components/header.tsx` (scroll), `components/account-settings-modal.tsx` (Escape), `components/ui/sidebar.tsx` (keydown + localStorage)
  - Fixes:
    - Add passive listener for scroll (`{ passive: true }`).
    - Consider focus trap/ARIA for the modal or adopt a dialog component.
    - Keep hydration‑flash protections (you already gate animations with `mounted`).

### Rendering & Types
- 🧩 Client component where not required
  - File: `apps/web/src/app/page.tsx`
  - Issue: Marked as client but only renders presentational content.
  - Fix: Convert to Server Component; keep only interactive islands client‑side.

- 🧩 Type safety and stable keys
  - Files: `components/header.tsx`, `components/ui/animated-group.tsx`, `components/hero-section.tsx`
  - Issues:
    - `as any` casts around `Link href` despite `typedRoutes: true`.
    - Index used as React key; `transitionVariants` typed as `any`.
  - Fixes:
    - Remove casts; use typed route strings.
    - Use stable keys (e.g., `item.name`).
    - Type animation variants as `Variants`.

### Security Headers (Next)
- 🪄 No security headers configured
  - File: `apps/web/next.config.mjs`
  - Fix: Add `async headers()` to emit CSP, HSTS, XFO, XCTO, Referrer‑Policy. Start permissive and tighten as needed (Clerk widgets, external images, etc.).

---

## Server (Bun + Elysia)

### Authentication & Context
- 🔥 Dev‑only header “auth”
  - File: `apps/server/src/lib/context.ts`
  - Issue: Trusts `x-user-id` to set session. This is not secure.
  - Fix: Replace with real auth verification (e.g., Clerk JWT verification or cookie‑session check). Remove reliance on caller‑supplied headers.

- ⚠️ CORS config mismatch
  - File: `apps/server/src/index.ts`
  - Issue: If you keep `x-user-id` for dev, it’s missing from `allowedHeaders`, causing preflight failures. Long‑term, remove the header and use real auth.
  - Fix: For dev only, include the header; for prod, remove both the header and its dependency.

### Security & Middleware
- ⚠️ Missing security middleware
  - Files: `apps/server/src/index.ts`
  - Issues: No rate limiting, compression, or security headers.
  - Fix: Add a simple rate limiter, gzip/br compression, and set common security headers (or ensure a reverse proxy does this). Add structured logging (pino) and normalized error responses.

### API Surface & Validation
- 🧩 Minimal routes
  - Files: `apps/server/src/routers/index.ts`
  - Notes: Good use of ORPC with `publicProcedure`/`protectedProcedure`; expand with zod input validation as routes grow.

---

## Cross‑Cutting
- ⚠️ Secrets management
  - Ensure `.env` files are not committed. Keep `*.example` templates. Prefer runtime secret injection in production.

- 🧩 Tests drift
  - UI tests under `apps/web/src/components/__tests__` assume Better‑Auth. Either update for Clerk or remove obsolete tests.

- 🧩 Consistency: single auth strategy
  - The repo references Better‑Auth and Clerk. Standardize on Clerk (as per README) and remove all Better‑Auth remnants.

---

## Suggested Immediate Fixes (Quick Wins) ✨
- [ ] Remove `/api/auth/:path*` rewrite from `apps/web/next.config.mjs`.
- [ ] Move non‑`NEXT_PUBLIC_*` secrets out of `apps/web/.env`; fix malformed line; update `apps/server/.env` and `.env.example`.
- [ ] Delete legacy auth files: `apps/web/src/lib/auth-client.ts`, `components/login-form.tsx`, `components/auth-form.tsx`, `app/api/auth/[...path]`.
- [ ] Convert `apps/web/src/app/page.tsx` to a Server Component.
- [ ] Replace index keys and `as any` casts in `components/header.tsx` and type `hero-section` variants.
- [ ] Add security headers in `apps/web/next.config.mjs` and basic compression/rate limiting on the server.
- [ ] Implement one TanStack Query usage (e.g., `orpc.privateData.useQuery()` on `/dashboard`) to validate the data layer.

---

## Nice‑To‑Haves
- Add React Query Devtools in non‑prod.
- Introduce a simple observability setup (request IDs, timing, structured logs).
- Document the chosen auth strategy (Clerk) in README and remove stale references.

---

## References (Paths)
- Effects
  - `apps/web/src/components/header.tsx`
  - `apps/web/src/components/account-settings-modal.tsx`
  - `apps/web/src/components/ui/sidebar.tsx`
  - `apps/web/src/components/login-form.tsx` (legacy auth)
- oRPC + Query wiring
  - `apps/web/src/utils/orpc.ts`
  - `apps/web/src/components/providers.tsx`
- Auth (Clerk)
  - `apps/web/src/app/layout.tsx`, `apps/web/src/middleware.ts`, `apps/web/src/app/auth/*`
- Server core
  - `apps/server/src/index.ts`, `apps/server/src/lib/context.ts`, `apps/server/src/routers/index.ts`

---

## Next Steps 🚀
If you want, I can:
- Apply the quick wins (remove rewrite, purge legacy auth files, fix `.env` locations).
- Add one example `useQuery` usage on the dashboard.
- Wire basic security headers/middleware on both web and server.

