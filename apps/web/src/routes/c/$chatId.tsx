/**
 * Chat Page - Individual chat conversation
 *
 * Route: /c/$chatId
 * Loads chat history and allows continuing the conversation.
 * Uses OSSChat Cloud (free tier) by default, no API key required.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-client";
import { ChatInterface } from "@/components/chat-interface";
import { Button } from "@/components/ui/button";
import { convexClient } from "@/lib/convex";

export const Route = createFileRoute("/c/$chatId")({
  component: ChatPage,
});

function ChatPage() {
  const { chatId } = Route.useParams();
  const { isAuthenticated, loading } = useAuth();

  if (!convexClient || loading) {
    return <div className="flex h-full bg-background" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-2xl font-bold">Sign in to continue</h1>
        <p className="text-muted-foreground">You need to be signed in to access this chat.</p>
        <Link to="/auth/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  return <ChatInterface chatId={chatId} />;
}
