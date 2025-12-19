import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { useAuth } from "../lib/auth-client";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { isAuthenticated, loading, user } = useAuth();
  const hasLoadedOnce = useRef(false);

  // Only show loading on first load, not on refetches
  if (loading && !hasLoadedOnce.current) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Mark as loaded after first successful load
  if (!loading) {
    hasLoadedOnce.current = true;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">OpenChat</h1>
      <p className="text-muted-foreground">AI Chat powered by OpenRouter</p>

      {isAuthenticated ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Welcome, {user?.name || user?.email}
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/chat">Start Chatting</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/settings">Settings</Link>
            </Button>
          </div>
        </div>
      ) : (
        <Button asChild>
          <Link to="/auth/sign-in">Sign In</Link>
        </Button>
      )}
    </div>
  );
}
