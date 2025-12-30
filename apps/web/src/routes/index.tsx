import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef } from 'react'
import { useAuth } from '../lib/auth-client'
import { Button } from '../components/ui/button'
import { ChatInterface } from '../components/chat-interface'
import { useOpenRouterKey } from '../stores/openrouter'

export const Route = createFileRoute('/')({
  component: HomePage,
})

// Icon for OpenRouter connection
const KeyIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
    />
  </svg>
)

// Connect OpenRouter CTA
function ConnectOpenRouterCTA() {
  const { initiateLogin, isLoading } = useOpenRouterKey()

  const handleConnect = () => {
    const callbackUrl = `${window.location.origin}/openrouter/callback`
    initiateLogin(callbackUrl)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <KeyIcon />
      </div>
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Connect OpenRouter
        </h1>
        <p className="mt-2 text-muted-foreground">
          Connect your OpenRouter account to start chatting with AI models. Your
          API key is stored securely in your browser.
        </p>
      </div>
      <Button onClick={handleConnect} disabled={isLoading} size="lg">
        {isLoading ? 'Connecting...' : 'Connect OpenRouter'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Don't have an account?{' '}
        <a
          href="https://openrouter.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          Sign up for OpenRouter
        </a>
      </p>
    </div>
  )
}

function HomePage() {
  const { isAuthenticated, loading } = useAuth()
  const { apiKey } = useOpenRouterKey()
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

  // Authenticated but no OpenRouter key - show connect CTA
  if (!apiKey) {
    return <ConnectOpenRouterCTA />
  }

  // Authenticated with OpenRouter key - show chat interface (new chat mode)
  return <ChatInterface />
}
