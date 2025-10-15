# Dependency Replacement Map

This file maps Next.js-specific APIs and packages to replacements in a TanStack Start (Vite) setup.

- next/navigation
  - `useRouter`, `usePathname`, `useSearchParams` -> `@tanstack/react-router` (`useRouter`, `useLocation`, `useSearch`)
  - `redirect()` (server) -> router navigation in loaders/actions or component-level `router.navigate()`; server redirects via Response with 3xx.

- next/link -> `Link` from `@tanstack/react-router`.

- next/headers (cookies, headers)
  - Use loader/action/server functions in TanStack Start for request/response access.
  - For non-SSR utilities, keep delegating to the Bun+Elysia server endpoints.

- NextResponse -> standard `Response` (Fetch API).

- App Router file structure (`app/**`)
  - Use TanStack Router file-based routes under `src/routes/**` with `createRootRoute`, `createFileRoute`.

- Metadata/Viewport
  - Use `@tanstack/react-router` head utilities or `react-helmet-async` for dynamic head management.

- Images
  - Native `<img>` or libraries like `unpic/react` as needed.

- Middleware
  - Most logic can be moved into a top-level request handler (Elysia) or route guard wrappers in TanStack Router.

- Rewrites/Proxying (next.config.mjs)
  - Use a Vite dev-server proxy or deploy-time reverse proxy (e.g., nginx, fly.io, etc.). For production, route `/rpc` & `/api/auth` to server.

