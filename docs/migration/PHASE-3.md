# TanStack Start Migration — Phase 3 (Routing & API)

Status: Bootstrapped routes with placeholders. No feature parity yet (uses Next.js UX for now).

Done
- Added initial file-based routes:
  - `/` (index)
  - `/auth` (redirects to `/auth/sign-in`)
  - `/auth/sign-in`, `/auth/sign-up` (placeholders)
  - `/dashboard`, `/dashboard/chat/$id` (placeholders)
- Vite dev proxy to server (`/rpc`, `/api/auth`).
- React Query provider wired at the root.

Pending / Next
- Port `/dashboard` pages and widgets.
- Implement guarded routes reading session from `@openchat/auth` via server endpoints.
- Replace `next/link` and `next/navigation` usage with TanStack Router in migrated components.
- Migrate `/api/chat` and `/api/openrouter/models` endpoints to server/Elysia or Start server functions.

