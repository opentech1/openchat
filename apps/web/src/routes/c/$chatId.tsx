/**
 * Chat Page - Individual chat conversation
 *
 * Route: /c/$chatId
 * Loads chat history and allows continuing the conversation.
 */

import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth-client'
import { useOpenRouterKey } from '@/stores/openrouter'
import { ChatInterface } from '@/components/chat-interface'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/c/$chatId')({
  component: ChatPage,
})

function ChatPage() {
  const { chatId } = Route.useParams()
  const { isAuthenticated, loading } = useAuth()
  const { apiKey } = useOpenRouterKey()

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-2xl font-bold">Sign in to continue</h1>
        <p className="text-muted-foreground">
          You need to be signed in to access this chat.
        </p>
        <Link to="/auth/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    )
  }

  // No OpenRouter key
  if (!apiKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-2xl font-bold">Connect OpenRouter</h1>
        <p className="text-muted-foreground">
          Connect your OpenRouter account to continue.
        </p>
        <Link to="/">
          <Button>Go to Home</Button>
        </Link>
      </div>
    )
  }

  return <ChatInterface chatId={chatId} />
}
