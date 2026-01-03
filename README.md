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


## Sponsors
<table>
  <tr>
    <td align="center" width="20%">
      <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/d80d057b-e651-49c3-a0eb-ee324274d549">
        <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/04dee790-d23a-4aed-93bb-5943e7f9cd5c">
        <img width="180" height="90" alt="Convex" src="https://github.com/user-attachments/assets/a7de908f-4226-44eb-a7c3-4fe7beb76897">
      </picture>
    </td>
    <td align="center" width="20%">
      <img width="180" height="90" alt="Greptile" src="https://github.com/user-attachments/assets/0dc5a5c7-2196-4270-b609-ea5a40f7e13e">
    </td>
    <td align="center" width="20%">
      <img width="180" height="90" alt="Gitbook" src="https://github.com/user-attachments/assets/ef2d2c18-0b94-424c-af39-cd40e0238665">
    </td>
    <td align="center" width="20%">
      <img width="180" height="90" alt="Sentry" src="https://github.com/user-attachments/assets/26266fa9-67a0-4256-9530-614f7ca4d2f5">
    </td>
    <td align="center" width="20%">
      <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/opentech1/openchat/main/apps/web/public/sponsors/graphite-black.png">
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/opentech1/openchat/main/apps/web/public/sponsors/graphite-white.png">
        <img width="120" height="120" alt="Graphite" src="https://raw.githubusercontent.com/opentech1/openchat/main/apps/web/public/sponsors/graphite-black.png">
      </picture>
    </td>
  </tr>
</table>


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
- `ANALYZE=true bun run build` – generate bundle size analysis report.

## Bundle Size Monitoring

OpenChat includes Next.js bundle analyzer for monitoring JavaScript bundle sizes and identifying optimization opportunities.

### Running Bundle Analysis

To analyze your production bundle:

```bash
# From the project root
ANALYZE=true bun run build

# Or from apps/web
cd apps/web
ANALYZE=true bun run build
```

This will:
1. Build the application for production
2. Generate interactive HTML reports showing bundle composition
3. Open reports in your default browser:
   - **Client bundle:** Shows all client-side JavaScript
   - **Server bundle:** Shows server-side code (if applicable)

### Reading the Reports

The analyzer visualizes your bundle as a treemap where:
- **Size of boxes** = file size (larger = more bytes)
- **Colors** = different modules/packages
- **Hover** = shows exact sizes and paths
- **Click** = drills down into nested dependencies

### What to Look For

1. **Large Dependencies**
   - Unexpectedly large third-party packages
   - Multiple versions of the same package (e.g., two versions of React)
   - Entire libraries imported when only a small part is used

2. **Optimization Opportunities**
   - Move large libraries to dynamic imports: `import('large-lib')`
   - Use tree-shaking compatible imports: `import { specific } from 'lib'` instead of `import lib from 'lib'`
   - Consider lighter alternatives for heavy packages

3. **Duplicate Code**
   - Same code appearing in multiple chunks
   - Shared dependencies not properly code-split

### Bundle Size Best Practices

- **Set budgets:** Configure bundle size budgets in next.config.mjs to fail builds that exceed limits
- **Monitor trends:** Run analysis regularly to catch regressions early
- **Lazy load:** Use dynamic imports for routes and heavy components
- **Code split:** Break up large bundles into smaller, on-demand chunks
- **Audit dependencies:** Regularly review and remove unused packages

### CI/CD Integration

Consider integrating bundle analysis into your CI pipeline:

```yaml
# Example GitHub Actions step
- name: Analyze bundle size
  run: ANALYZE=true bun run build
  env:
    CI: true

- name: Upload bundle stats
  uses: actions/upload-artifact@v3
  with:
    name: bundle-analysis
    path: apps/web/.next/analyze/
```

For more details on bundle optimization, see:
- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [Web Performance Best Practices](https://web.dev/performance/)
- `/apps/web/src/lib/image-config.ts` for image optimization guidelines

## Environment Notes
- The chat API reads per-user OpenRouter keys from encrypted storage; without a key chats will prompt for one.
- Rate limiting and streaming behavior is controlled via `OPENROUTER_*` env vars (see `apps/web/src/app/api/chat/chat-handler.ts`).
- WorkOS AuthKit redirects unauthenticated visitors from `/dashboard` to the hosted sign-in page; set `NEXT_PUBLIC_DEV_BYPASS_AUTH=1` to allow local guest flows.
- Convex URLs are mirrored between server (`CONVEX_URL`) and browser (`NEXT_PUBLIC_CONVEX_URL`). When running behind a proxy, ensure both point to TLS origins.

## Deployment
- Docker Compose and Dokploy guides live under `docs/deployment/`. They cover container topology, environment wiring, and production secrets.
- The repository ships `docker/web.Dockerfile` and `docker/convex.Dockerfile` images that are referenced in the compose manifests.
- For bespoke hosting, review `docs/SYNC.md` for websocket expectations and `posthog.md` for analytics instrumentation before scaling out.

### Rate Limiting

OpenChat includes built-in rate limiting for API endpoints with support for both single-instance and multi-instance deployments.

**Single Instance (default):** In-memory rate limiting
- Fast and efficient with no external dependencies
- Suitable for single-server deployments
- Rate limits are per-instance only
- No additional setup required

**Multi Instance:** Redis-based distributed rate limiting
- Shared rate limits across all server instances
- Essential for load-balanced or horizontal scaling deployments
- Requires Redis server and `ioredis` package

To enable Redis-based rate limiting:

1. **Install ioredis** (optional dependency):
   ```bash
   bun add ioredis
   ```

2. **Set REDIS_URL environment variable**:
   ```bash
   # Local Redis
   REDIS_URL=redis://localhost:6379

   # Remote Redis with auth
   REDIS_URL=redis://:password@redis-host:6379

   # Redis Cluster
   REDIS_URL=redis://redis-cluster:6379
   ```

3. **Start your application**:
   ```bash
   REDIS_URL=redis://localhost:6379 bun run start
   ```

The application will automatically detect the `REDIS_URL` environment variable and switch to distributed rate limiting. No code changes are required.

For local development with Redis:
```bash
# Start Redis with Docker
docker run -d -p 6379:6379 redis:alpine

# Run OpenChat
REDIS_URL=redis://localhost:6379 bun dev
```

**Note:** Rate limiting configuration is defined in `/apps/web/src/lib/rate-limit.ts`. The system automatically falls back to in-memory rate limiting if Redis is unavailable.

## Additional Documentation
- `docs/SYNC.md` – design document for the realtime `/sync` websocket hub.
- `posthog.md` – event naming strategy and dashboards.
- `AGENTS.md` – condensed repo guidelines for automation.

## Contributing & Support
- Read `CONTRIBUTING.md` for coding standards, testing expectations, and PR etiquette.
- Security or conduct issues should follow the guidelines in `CODE_OF_CONDUCT.md`.

## License

OpenChat is licensed under the [GNU Affero General Public License v3](LICENSE).

---

Happy coding! If you have questions, feel free to open an issue.
