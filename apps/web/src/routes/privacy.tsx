/**
 * Privacy Policy Page
 */

import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy - osschat" },
      { name: "description", content: "Privacy policy for osschat. Learn how we handle your data, what we collect, and how we protect your privacy." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Privacy Policy - osschat" },
      { property: "og:description", content: "Learn how osschat handles your data and protects your privacy." },
      { property: "og:url", content: "https://osschat.dev/privacy" },
    ],
    links: [
      { rel: "canonical", href: "https://osschat.dev/privacy" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to osschat
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: January 2025</p>

        <p className="text-muted-foreground leading-relaxed mb-12">
          At osschat, we take your privacy seriously. This policy explains what data we collect, how we use it, and your rights regarding your information.
        </p>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">What We Collect</h2>

          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold mb-2">Account Information</h3>
              <p className="text-sm text-muted-foreground mb-3">When you sign in with GitHub, we receive and store:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Your GitHub username and display name</li>
                <li>Your email address (from GitHub)</li>
                <li>Your GitHub profile picture URL</li>
              </ul>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold mb-2">Chat Data</h3>
              <p className="text-sm text-muted-foreground mb-3">We store your chat conversations so you can access them across sessions:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Messages you send and AI responses</li>
                <li>Which AI model was used for each conversation</li>
                <li>Timestamps of your conversations</li>
              </ul>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold mb-2">Usage Data</h3>
              <p className="text-sm text-muted-foreground mb-3">We track anonymous usage metrics to improve our service:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Page views and feature usage</li>
                <li>Error reports</li>
                <li>Performance metrics</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">How We Use Your Data</h2>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex gap-3">
              <span className="text-primary font-semibold">•</span>
              <span><strong className="text-foreground">Provide the service</strong> - Store and retrieve your conversations</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-semibold">•</span>
              <span><strong className="text-foreground">Improve osschat</strong> - Analyze usage patterns to make the product better</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-semibold">•</span>
              <span><strong className="text-foreground">Prevent abuse</strong> - Monitor for suspicious activity and enforce usage limits</span>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">What We Don't Do</h2>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <svg className="size-5 text-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>We <strong className="text-foreground">do not</strong> sell your data to third parties</span>
              </li>
              <li className="flex gap-2">
                <svg className="size-5 text-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>We <strong className="text-foreground">do not</strong> use your conversations to train AI models</span>
              </li>
              <li className="flex gap-2">
                <svg className="size-5 text-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>We <strong className="text-foreground">do not</strong> share your data with advertisers</span>
              </li>
              <li className="flex gap-2">
                <svg className="size-5 text-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>We <strong className="text-foreground">do not</strong> read your private conversations</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold mb-2">OpenRouter</h3>
              <p className="text-sm text-muted-foreground">
                Your messages are sent to <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenRouter</a> for AI processing. OpenRouter then routes your request to the appropriate AI provider. Please review <a href="https://openrouter.ai/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenRouter's privacy policy</a> for details.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold mb-2">Convex</h3>
              <p className="text-sm text-muted-foreground">
                We use <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Convex</a> as our database provider. Your data is stored securely on their infrastructure.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
          <p className="text-muted-foreground mb-4">You have the right to:</p>
          <ul className="space-y-2 text-muted-foreground ml-4 list-disc">
            <li>Access your data</li>
            <li>Delete your account and all associated data</li>
            <li>Export your conversations</li>
            <li>Opt out of analytics tracking</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Security</h2>
          <p className="text-muted-foreground mb-4">We implement industry-standard security measures:</p>
          <ul className="space-y-2 text-muted-foreground ml-4 list-disc">
            <li>All data is transmitted over HTTPS</li>
            <li>Authentication is handled securely through GitHub OAuth</li>
            <li>API keys are encrypted before storage</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Open Source Transparency</h2>
          <p className="text-muted-foreground leading-relaxed">
            osschat is open source. You can <a href="https://github.com/tryosschat/openchat" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">inspect our code</a> to verify exactly how we handle your data.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Contact</h2>
          <p className="text-muted-foreground">
            Questions about this privacy policy? Contact us on X at <a href="https://x.com/osschat" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@osschat</a>.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <a href="https://github.com/tryosschat/openchat" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
