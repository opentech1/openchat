/**
 * About Page - Information about osschat
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About osschat - Open Source AI Chat Platform" },
      { name: "description", content: "Learn about osschat, the open source AI chat platform with access to 350+ models including GPT-4, Claude, and Gemini. Built for privacy and transparency." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "About osschat" },
      { property: "og:description", content: "Learn about osschat, the open source AI chat platform with access to 350+ models." },
      { property: "og:url", content: "https://osschat.dev/about" },
    ],
    links: [
      { rel: "canonical", href: "https://osschat.dev/about" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
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
        <h1 className="text-4xl font-bold tracking-tight mb-4">About osschat</h1>

        <p className="text-xl text-muted-foreground mb-12">
          osschat is an open source AI chat platform that gives you access to over 350 AI models through a single, beautiful interface.
        </p>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            We believe AI should be accessible to everyone. That's why we built osschat - a free, open source alternative to proprietary AI chat applications. No vendor lock-in, no hidden costs, just powerful AI at your fingertips.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <div className="grid gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold mb-1">350+ AI Models</h3>
              <p className="text-sm text-muted-foreground">Access GPT-4, Claude, Gemini, Llama, Mistral, and hundreds more through OpenRouter</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold mb-1">Free Tier</h3>
              <p className="text-sm text-muted-foreground">Get started immediately with our free daily quota, no API key required</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold mb-1">Bring Your Own Key</h3>
              <p className="text-sm text-muted-foreground">Connect your OpenRouter account for unlimited usage</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold mb-1">Privacy First</h3>
              <p className="text-sm text-muted-foreground">Your conversations stay yours. We don't train on your data</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold mb-1">100% Open Source</h3>
              <p className="text-sm text-muted-foreground">Inspect the code, self-host, or contribute on GitHub</p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              osschat uses <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenRouter</a> as our AI provider, which gives us access to models from OpenAI, Anthropic, Google, Meta, and many other providers through a single API.
            </p>
            <p>
              New users get a free daily quota to try out different models. For unlimited access, you can connect your own OpenRouter account with your API key.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Open Source</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            osschat is fully open source and available on GitHub. We welcome contributions, bug reports, and feature requests from the community.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/tryosschat/openchat"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                View on GitHub
              </Button>
            </a>
            <Link to="/auth/sign-in">
              <Button>Get Started Free</Button>
            </Link>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Contact</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Have questions or feedback? Reach out to us on X:
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="https://x.com/osschat" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@osschat</a>
            <span className="text-muted-foreground">·</span>
            <a href="https://x.com/leodev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@leodev</a>
          </div>
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
