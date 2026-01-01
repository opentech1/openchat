import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef } from 'react'
import { useAuth } from '../lib/auth-client'
import { Button } from '../components/ui/button'
import { ChatInterface } from '../components/chat-interface'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { isAuthenticated, loading } = useAuth()
  const hasLoadedOnce = useRef(false)

  // Only show loading on first load, not on refetches
  if (loading && !hasLoadedOnce.current) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Mark as loaded after first successful load
  if (!loading) {
    hasLoadedOnce.current = true
  }

  // Not authenticated - show sign in
  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-4xl font-bold tracking-tight">OpenChat</h1>
        <p className="text-muted-foreground">AI Chat powered by OpenRouter</p>
        <Link to="/auth/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    )
  }

  // Authenticated - show chat interface (new chat mode)
  // OSSChat Cloud provides free access with daily limits, no API key needed
  return <ChatInterface />
}
