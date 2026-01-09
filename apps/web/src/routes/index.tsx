import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { ChatInterface } from "../components/chat-interface";
import { ChangelogButton } from "../components/changelog-button";
import { convexClient } from "../lib/convex";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { isAuthenticated, loading } = useAuth();

  if (!convexClient || loading) {
    return <div className="flex h-full bg-background" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-6 p-8">
        <div className="absolute top-4 right-4">
          <ChangelogButton />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">osschat</h1>
        <p className="text-muted-foreground">Open source AI chat powered by OpenRouter</p>
        <Link to="/auth/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  return <ChatInterface />;
}
