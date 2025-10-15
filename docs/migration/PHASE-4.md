# TanStack Start Migration — Phase 4 (Components & State)

Status: Route guards initialized; component migration pending.

Done
- Added simple auth guards via `beforeLoad` for `/dashboard` and `/dashboard/chat/$id` using `/api/auth/get-session`.
- Providers wired with React Query.

Pending / Next
- Port UI components from Next app to TanStack app, swapping:
  - `next/link` -> `@tanstack/react-router` `Link`
  - `useRouter`, `usePathname`, `useSearchParams` -> Router equivalents
- Replace server components with client components and pass data via loaders/queries.
- Move chat room logic to TanStack app and integrate with oRPC endpoints.
- Migrate Better-Auth client usage and session state display.

