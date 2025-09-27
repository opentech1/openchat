# openchat

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Elysia, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Elysia** - Type-safe, high-performance framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better Auth (Bun API + Next.js App Router)
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```
## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:
```bash
bun db:push
```


Then, run the development servers (web + server only):

```bash
bun dev
```

Open [http://localhost:3001](http://localhost:3001) for the web app.
The API runs at [http://localhost:3000](http://localhost:3000).





## Project Structure

```
openchat/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   └── server/      # Backend API (Elysia, ORPC)
```

## Available Scripts

- `bun dev`: Start web and server in development mode
- `bun build`: Build all applications
- `bun dev:web`: Start only the web application
- `bun dev:server`: Start only the server
- `bun dev:extension`: Start only the browser extension (not started by default)
- `bun check-types`: Check TypeScript types across all apps
- `bun db:push`: Push schema changes to database
- `bun db:studio`: Open database studio UI
- `bun run verify:build`: Clean the web build cache and run both the Next.js and Turbo build pipelines (mirrors the Docker deploy build)

## Docker Compose

Use the root `docker-compose.yml` to run Postgres, ElectricSQL, the Bun API, and the Next.js frontend together:

```bash
cp .env.docker.example .env
# edit .env with Better Auth secrets and production URLs
docker compose up --build
```

The stack exposes: 3000 (API), 3001 (web), 3010 (Electric HTTP), 5133 (Electric proxy), and 5432 (Postgres). Update the `.env` file to point at your Traefik routes or production domains before running `docker compose up`.

## Environment Variables

| Variable | Scope | Description |
| --- | --- | --- |
| NEXT_PUBLIC_SERVER_URL | Web | Base URL for the Bun API (e.g. https://api.ochat.pro). |
| NEXT_PUBLIC_APP_URL | Web | Public origin for the Next.js app, used for CORS and metadata. |
| NEXT_PUBLIC_ELECTRIC_URL | Web | Base URL for the ElectricSQL service used for live TanStack DB collections. |
| ELECTRIC_SERVICE_URL | Server | Base URL for the ElectricSQL HTTP API consumed by the backend proxy. |
| ELECTRIC_GATEKEEPER_SECRET | Server | HMAC secret for issuing ElectricSQL Gatekeeper tokens. |
| BETTER_AUTH_SECRET | Server | Secret used by Better Auth to encrypt cookies and sessions (generate 32+ characters). |
| BETTER_AUTH_URL | Server | Public URL where Better Auth handlers are exposed (usually the API origin). |
| AUTH_COOKIE_DOMAIN | Server | Optional cookie domain (e.g. .ochat.pro) for cross-subdomain sessions. |
| DATABASE_URL | Server | Postgres connection string consumed by both the Bun API and Better Auth. |
| SERVER_INTERNAL_URL | Server | Optional override for internal ORPC calls when the public URL differs. |
| OPENROUTER_API_KEY_SECRET | Server | Secret used to encrypt/decrypt each browser’s locally stored OpenRouter API key (must be ≥16 chars). |
| DEV_ALLOW_HEADER_BYPASS | Server | Set to 1 in local dev to trust x-user-id headers; leave unset in production. |
| NEXT_PUBLIC_DEV_BYPASS_AUTH / NEXT_PUBLIC_DEV_USER_ID | Web (dev) | Enables the local Better Auth bypass user for development flows. |
| NEXT_DISABLE_REMOTE_FONT_DOWNLOADS | Web (dev) | Set to 1 to skip Google Fonts downloads when running in a sandbox. |

## Streaming & Sync

### ElectricSQL (local dev)

1. Copy the environment examples: `cp apps/web/.env.example apps/web/.env.local` and `cp apps/server/.env.example apps/server/.env` (adjust values as needed).
2. To run everything in containers, `docker compose up --build` (see [Docker Compose](#docker-compose)); this exposes Electric on `http://localhost:3010` and Postgres on `5432`. Otherwise provide your own Postgres + Electric services and point the URLs below at them.
3. Ensure the following variables are set before running `bun dev`:

   ```bash
   # apps/web/.env.local
   NEXT_PUBLIC_SERVER_URL=http://localhost:3000
   NEXT_PUBLIC_ELECTRIC_URL=http://localhost:3010
   NEXT_PUBLIC_DEV_BYPASS_AUTH=1
   NEXT_PUBLIC_DEV_USER_ID=dev-user

   # apps/server/.env
   ELECTRIC_SERVICE_URL=http://localhost:3010
   ELECTRIC_GATEKEEPER_SECRET=dev-gatekeeper-secret
   DEV_ALLOW_HEADER_BYPASS=1
   SERVER_INTERNAL_URL=http://localhost:3000
   OPENROUTER_API_KEY_SECRET=dev-openrouter-secret
   ```

   Restart `bun dev` after exporting the variables so the proxy can issue Gatekeeper tokens and the web app can subscribe to Electric shapes.

### OpenRouter API key handling

- Each browser session encrypts the OpenRouter API key with a randomly generated AES key (via the Web Crypto API) and stores the ciphertext in `localStorage`.
- When you paste a key into the modal, OpenChat proxies requests through `/api/openrouter/models` and `/api/chat`, forwarding the key to OpenRouter over HTTPS for the lifetime of each request. The server never stores or logs the key outside of that transient call.
- Clearing your browser storage (or clicking **Remove key** in the upcoming settings page) wipes the encrypted blob, effectively unlinking your OpenRouter account locally.

- `/api/chat` now persists the latest user message before the model call and streams assistant tokens by calling `messages.streamUpsert`, so other tabs receive ElectricSQL updates while the active tab consumes the SSE stream.
- Electric-backed TanStack DB collections hydrate the sidebar and chat views when `NEXT_PUBLIC_ELECTRIC_URL`/Gatekeeper are configured. Requests now proxy through the server at `/api/electric/shapes/*`, so the Electric service itself never receives user-identifying cookies directly. The legacy WebSocket fallback remains for non-Electric setups.
- The new `messages.streamUpsert` ORPC procedure accepts `streaming` and `completed` states so fan-out consumers (Electric or WebSocket) can keep partial content in sync.

## Auth (Better Auth)

Better Auth replaces Clerk and runs inside the Bun API (Elysia) while also exposing a helper route in the Next.js app.

1. Generate a long random string for `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL` to your API origin (e.g. `https://api.ochat.pro`).
2. When serving multiple subdomains (web + api), set `AUTH_COOKIE_DOMAIN` to the shared suffix such as `.ochat.pro` so cookies flow across hosts.
3. The shared `@openchat/auth` package exports the auth instance, the React client (`authClient`), and the Next.js route handler re-exported at `/api/auth/[...all]`.
4. The Bun API automatically mounts `/api/auth/*` (with rate limiting) and resolves sessions via `auth.api.getSession`.
5. Components call `authClient.useSession()` to reactively access the current user, and invoke helpers such as `authClient.signIn.email`, `authClient.signUp.email`, and `authClient.signOut` to manage credentials.

In local development you can still opt into the mock user by setting `NEXT_PUBLIC_DEV_BYPASS_AUTH=1` and `NEXT_PUBLIC_DEV_USER_ID`; the Bun API respects this when `DEV_ALLOW_HEADER_BYPASS=1`.
