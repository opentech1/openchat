# OpenChat - Claude Code Instructions

This file contains important patterns and guidelines for AI agents working on this codebase.

## Project Structure

```
apps/
  web/          # TanStack Start frontend (Vite + TanStack Router)
  web-old/      # Legacy Next.js frontend (deprecated)
  server/       # Convex backend
```

## Routing

The app uses **TanStack Router** with file-based routing in `apps/web/src/routes/`:

| Route | File | Purpose |
|-------|------|---------|
| `/` | `index.tsx` | Home / New chat |
| `/c/$chatId` | `c/$chatId.tsx` | Chat conversation |
| `/settings` | `settings.tsx` | User settings |
| `/auth/sign-in` | `auth/sign-in.tsx` | Sign in page |
| `/auth/callback` | `auth/callback.tsx` | OAuth callback |
| `/openrouter/callback` | `openrouter/callback.tsx` | OpenRouter OAuth |
| `/api/chat` | `api/chat.ts` | Chat streaming API |

## Tech Stack

- **Frontend**: TanStack Start (Vite), TanStack Router, React 19, TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database)
- **Auth**: Better Auth with GitHub OAuth, synced to Convex
- **AI**: OpenRouter (via AI SDK 5) with streaming responses
- **Analytics**: PostHog, Vercel Analytics
- **UI**: shadcn/ui components

## Authentication Flow

1. User signs in with GitHub via Better Auth
2. Better Auth session stored in cookies
3. `users.ensure` mutation syncs user to Convex (by externalId)
4. All queries use Convex user ID (not Better Auth ID)

```tsx
// Get Better Auth user
const { user } = useAuth()

// Get Convex user ID for queries
const convexUser = useQuery(api.users.getByExternalId, { externalId: user?.id })
const convexUserId = convexUser?._id
```

## AI Chat Architecture

### Providers
- **OSSChat Cloud** (default): Free tier using server's `OPENROUTER_API_KEY`, 10¢/day limit
- **Personal OpenRouter**: User's own API key for unlimited access

### Streaming
Uses AI SDK 5 with OpenRouter:
```tsx
// apps/web/src/routes/api/chat.ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText } from 'ai'

const openrouter = createOpenRouter({ apiKey })
const result = streamText({ model: openrouter(modelId), messages })
```

### Model Selection
Models fetched from OpenRouter API (`https://openrouter.ai/api/v1/models`) with 4-hour cache.
Pricing loaded dynamically for cost tracking.

## Important Patterns

### Convex Client Creation

```tsx
// apps/web/src/providers/convex.tsx
const convexUrl = import.meta.env.VITE_CONVEX_URL
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null
```

### Auth Client

```tsx
// apps/web/src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
})
```

### Environment Variables

TanStack Start uses Vite, so client-side env vars use `VITE_` prefix:
- `VITE_CONVEX_URL` - Convex deployment URL
- `VITE_CONVEX_SITE_URL` - Convex HTTP actions URL (for auth)
- `VITE_POSTHOG_KEY` - PostHog analytics key

Server-side env vars (in API routes):
- `OPENROUTER_API_KEY` - Server's OpenRouter key for free tier
- `VALYU_API_KEY` - Web search API key

## State Management

### Zustand Stores
- `stores/model.ts` - Model selection, favorites, cached model list
- `stores/provider.ts` - Active provider (osschat/openrouter), usage tracking
- `stores/openrouter.ts` - Personal OpenRouter API key (encrypted in localStorage)
- `stores/ui.ts` - Sidebar state, theme

### Usage Tracking
```tsx
// stores/provider.ts
const { dailyUsageCents, addUsage, isOverLimit } = useProviderStore()
```

## GitHub Repository

https://github.com/opentech1/openchat
