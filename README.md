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
- **Authentication** - Clerk (Next.js App Router)
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
## Auth (Clerk)

Set Clerk environment variables in `apps/web/.env` (do not commit real keys):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_SECRET_KEY
```

Integration:

- `apps/web/middleware.ts` uses `clerkMiddleware()` to protect routes.
- `apps/web/src/app/layout.tsx` wraps the app with `<ClerkProvider>`.
- `apps/web/src/app/auth/sign-in/page.tsx` renders `<SignIn afterSignInUrl="/dashboard" />`.
- `apps/web/src/app/auth/sign-up/page.tsx` renders `<SignUp afterSignUpUrl="/dashboard" />`.
- `apps/web/src/app/dashboard/page.tsx` uses `auth()` from `@clerk/nextjs/server` to gate access.
