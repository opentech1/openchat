import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import { useAuth, signOut } from "../lib/auth-client";
import { useOpenRouterKey } from "../stores/openrouter";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const { apiKey, clearApiKey } = useOpenRouterKey();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Please sign in to access settings.</p>
        <Link to="/auth/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Link to="/">
          <Button variant="outline" size="sm">Back to Chat</Button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* Account Section */}
        <section className="rounded-lg border border-border p-6">
          <h2 className="mb-4 text-lg font-semibold">Account</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user?.name || user?.email}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Button variant="outline" onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
          </div>
        </section>

        {/* OpenRouter Section */}
        <section className="rounded-lg border border-border p-6">
          <h2 className="mb-4 text-lg font-semibold">OpenRouter</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">API Key</p>
                <p className="text-sm text-muted-foreground">
                  {apiKey ? "Connected" : "Not connected"}
                </p>
              </div>
              {apiKey && (
                <Button variant="outline" onClick={clearApiKey}>
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
