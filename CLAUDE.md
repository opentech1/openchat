# OpenChat - Claude Code Instructions

This file contains important patterns and guidelines for AI agents working on this codebase.

## Project Structure

```
apps/
  web/          # Next.js 16 frontend (App Router)
  server/       # Convex backend
```

## Routing

The app uses a **route group** `(dashboard)` for the main authenticated routes.
Routes are at the root level (no `/dashboard` prefix):

| Route | Purpose |
|-------|---------|
| `/` | Dashboard home |
| `/chat/[id]` | Chat page |
| `/settings` | Settings |
| `/templates` | Templates list |
| `/templates/new` | New template |
| `/templates/[id]` | Edit template |
| `/new` | New chat |
| `/auth/sign-in` | Sign in |
| `/auth/callback` | OAuth callback |

## Critical: Hydration Error Prevention

### The Problem

In Next.js client components, `<Suspense>` causes hydration mismatches because:
1. Server renders the Suspense boundary
2. Scripts get injected into DOM (analytics, dev tools, theme providers)
3. Client hydration finds `<script>` tags where it expected Suspense
4. React throws hydration mismatch error

### The Solution: NEVER Use Suspense in Client Components

We have two utilities to replace Suspense:

#### 1. `useMounted` Hook (for simple cases)

```tsx
import { useMounted } from "@/hooks/use-mounted";

function MyComponent() {
  const mounted = useMounted();

  if (!mounted) return <LoadingSkeleton />;

  return <ActualContent />;
}
```

#### 2. `<ClientOnly>` Component (drop-in Suspense replacement)

```tsx
import { ClientOnly } from "@/components/client-only";

// Instead of:
<Suspense fallback={<Loading />}>
  <MyComponent />
</Suspense>

// Use:
<ClientOnly fallback={<Loading />}>
  <MyComponent />
</ClientOnly>
```

### Why This Works

```
Server:           renders fallback (or null)
Client hydration: renders fallback (or null) - MATCHES!
After mount:      renders actual content
```

No mismatch, no error.

### When to Use

| Scenario | Solution |
|----------|----------|
| Component uses `useSearchParams` | `<ClientOnly>` or `useMounted` |
| Component uses browser-only APIs | `<ClientOnly>` or `useMounted` |
| Previously used Suspense in "use client" | Replace with `<ClientOnly>` |
| Analytics/tracking components | `useMounted` + return null |
| Radix UI dialogs/modals (ID mismatch) | `useMounted` + return null |
| Any hydration mismatch error | Use these patterns |

### Avoid: `dynamic` with `ssr: false` (No Loading Fallback)

```tsx
// BAD - causes hydration issues (uses Suspense internally)
const Component = dynamic(() => import("./component"), { ssr: false });

// OK - has loading fallback that matches server/client
const Component = dynamic(() => import("./component"), {
  ssr: false,
  loading: () => <Skeleton />,  // Must be identical on server and client
});

// BEST - use useMounted pattern instead
import { useMounted } from "@/hooks/use-mounted";
import { Component } from "./component";

function Wrapper() {
  const mounted = useMounted();
  if (!mounted) return null;  // or <Skeleton />
  return <Component />;
}
```

### Files Using These Patterns

- `src/components/providers.tsx` - ClientToaster, PosthogPageViewTracker
- `src/components/client-analytics.tsx` - SpeedInsights, Analytics
- `src/components/posthog-bootstrap.tsx` - PosthogBootstrapClient
- `src/components/command-palette.tsx` - CommandDialog (Radix UI)
- `src/app/auth/sign-in/page.tsx` - LoginPage
- `src/app/auth/callback/page.tsx` - AuthCallbackPage
- `src/app/openrouter/callback/page.tsx` - OpenRouterCallbackPage

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database)
- **Auth**: WorkOS AuthKit with GitHub/Google OAuth
- **Analytics**: PostHog, Vercel Analytics
- **UI**: shadcn/ui components

## Important Patterns

### Convex Client Creation

The Convex client is created at module scope and only in the browser:

```tsx
const convexClient = typeof window !== "undefined" && convexUrl
  ? new ConvexReactClient(convexUrl)
  : null;
```

### Theme Provider

Uses `next-themes` which injects an inline script. This is expected behavior but can cause issues if combined with Suspense.

### Analytics

SpeedInsights and Analytics from Vercel are wrapped in `ClientAnalytics` component with `useMounted` to prevent hydration issues.

## Common Issues & Solutions

### "Hydration failed" Error

1. Check if Suspense is used in a client component
2. Replace with `<ClientOnly>` or `useMounted` pattern
3. Ensure server and client initial render are identical

### "Cannot find Convex client" Error

This happens during SSR/SSG. The `Providers` component handles this by rendering a fallback tree without Convex providers when `convexClient` is null.

## GitHub Repository

https://github.com/opentech1/openchat
