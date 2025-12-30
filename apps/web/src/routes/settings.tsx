/**
 * Settings Page
 */

import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAuth, signOut } from '@/lib/auth-client'
import { useOpenRouterKey } from '@/stores/openrouter'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          Please sign in to access settings.
        </p>
        <Link to="/auth/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon />
          Back to Chat
        </Link>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          Sign out
        </Button>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl p-6">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Profile Card */}
          <Card>
            <CardContent className="flex flex-col items-center pt-6">
              <Avatar size="lg" className="size-20">
                <AvatarImage
                  src={user.image || undefined}
                  alt={user.name || 'User'}
                />
                <AvatarFallback className="text-lg">
                  {(user.name || user.email || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-lg font-semibold">
                {user.name || 'User'}
              </h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="account">
            <TabsList>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="providers">Providers</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="mt-4">
              <AccountTab user={user} />
            </TabsContent>

            <TabsContent value="providers" className="mt-4">
              <ProvidersTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

function AccountTab({
  user,
}: {
  user: { name?: string | null; email?: string | null }
}) {
  return (
    <div className="space-y-6">
      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details from GitHub</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-medium">Name</p>
              <p className="text-sm text-muted-foreground">
                {user.name || 'Not set'}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">
                {user.email || 'Not set'}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Authentication</p>
              <p className="text-sm text-muted-foreground">GitHub OAuth</p>
            </div>
            <span className="flex items-center gap-1 text-sm text-primary">
              <CheckIcon />
              Connected
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="destructive" size="sm" disabled>
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProvidersTab() {
  const { apiKey, clearApiKey, initiateLogin } = useOpenRouterKey()

  const handleConnect = () => {
    const callbackUrl = `${window.location.origin}/openrouter/callback`
    initiateLogin(callbackUrl)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>OpenRouter</CardTitle>
          <CardDescription>Access 200+ AI models with one API</CardDescription>
        </CardHeader>
        <CardContent>
          {apiKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckIcon />
                Connected
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <div>
                  <p className="text-xs text-muted-foreground">API Key</p>
                  <p className="font-mono text-sm">
                    {apiKey.slice(0, 8)}...{apiKey.slice(-4)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={clearApiKey}>
                  Disconnect
                </Button>
              </div>
              <a
                href="https://openrouter.ai/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Manage on OpenRouter
                <ExternalLinkIcon />
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your OpenRouter account to access AI models like GPT-4,
                Claude, and more.
              </p>
              <Button onClick={handleConnect}>Connect OpenRouter</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          More providers coming soon...
        </CardContent>
      </Card>
    </div>
  )
}

// Icons
function ArrowLeftIcon() {
  return (
    <svg
      className="size-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="size-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg
      className="size-3"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  )
}
