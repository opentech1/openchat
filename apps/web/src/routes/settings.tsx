/**
 * Settings Page - Account and app configuration
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import { useAuth, signOut } from "../lib/auth-client";
import { useOpenRouterKey } from "../stores/openrouter";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

// Icons
const ArrowLeftIcon = () => (
  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const UserIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

const KeyIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
    />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="size-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const XCircleIcon = () => (
  <svg className="size-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

function SettingsPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const { apiKey, clearApiKey, initiateLogin } = useOpenRouterKey();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Please sign in to access settings.</p>
        <Link to="/auth/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  const handleConnectOpenRouter = () => {
    const callbackUrl = `${window.location.origin}/openrouter/callback`;
    initiateLogin(callbackUrl);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon />
            Back to chat
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Section */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-3">
              <UserIcon />
              <h2 className="font-medium">Account</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="size-14 rounded-full"
                  />
                ) : (
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-medium text-primary-foreground">
                    {(user?.name || user?.email || "U")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-medium">
                    {user?.name || "User"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
                <Button variant="outline" onClick={() => signOut()}>
                  Sign out
                </Button>
              </div>
            </div>
          </section>

          {/* OpenRouter Section */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-3">
              <KeyIcon />
              <h2 className="font-medium">OpenRouter</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {apiKey ? <CheckCircleIcon /> : <XCircleIcon />}
                  <div>
                    <p className="font-medium">API Connection</p>
                    <p className="text-sm text-muted-foreground">
                      {apiKey
                        ? "Your OpenRouter account is connected"
                        : "Connect to access AI models"}
                    </p>
                  </div>
                </div>
                {apiKey ? (
                  <Button variant="outline" onClick={clearApiKey}>
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={handleConnectOpenRouter}>
                    Connect
                  </Button>
                )}
              </div>
              {apiKey && (
                <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Your API key is stored securely in your browser's local storage.
                    It is never sent to our servers.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Danger Zone */}
          <section className="overflow-hidden rounded-xl border border-destructive/30 bg-card">
            <div className="flex items-center gap-3 border-b border-destructive/30 bg-destructive/5 px-5 py-3">
              <svg className="size-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="font-medium text-destructive">Danger Zone</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive" disabled>
                  Delete Account
                </Button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>osschat · Open source AI chat</p>
        </div>
      </div>
    </div>
  );
}
