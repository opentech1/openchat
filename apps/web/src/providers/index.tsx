/**
 * App Providers - Clean provider composition
 */

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { Toaster } from 'sonner'
import { convexClient } from '../lib/convex'
import { authClient } from '../lib/auth-client'
import { ThemeProvider } from './theme-provider'
import { PostHogProvider } from './posthog'
import { prefetchModels } from '../stores/model'

// Prefetch models.dev data early (cached, won't block render)
if (typeof window !== 'undefined') {
  prefetchModels()
}

// Singleton query client - disable refetch on window focus to prevent tab-switch flashing
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  // Track if we're on the client side with Convex available
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])

  const content = (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="bottom-right" theme="system" />
      </QueryClientProvider>
    </ThemeProvider>
  )

  // During SSR or before hydration, don't render Convex-dependent content
  // This prevents the "Could not find Convex client" error
  if (!isClient || !convexClient) {
    return (
      <PostHogProvider>
        {content}
      </PostHogProvider>
    )
  }

  // Client-side with valid Convex client - use full auth provider
  return (
    <PostHogProvider>
      <ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
        {content}
      </ConvexBetterAuthProvider>
    </PostHogProvider>
  )
}
