/**
 * Terms of Service Page
 */

import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service - osschat" },
      { name: "description", content: "Terms of service for osschat. Understand the rules and guidelines for using our open source AI chat platform." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Terms of Service - osschat" },
      { property: "og:description", content: "Terms of service for using osschat AI chat platform." },
      { property: "og:url", content: "https://osschat.dev/terms" },
    ],
    links: [
      { rel: "canonical", href: "https://osschat.dev/terms" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
        <h1 className="text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: January 2025</p>

        <p className="text-muted-foreground leading-relaxed mb-12">
          Welcome to osschat. By using our service, you agree to these terms. Please read them carefully.
        </p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            By accessing or using osschat, you agree to be bound by these Terms of Service and our Privacy Policy. If you don't agree to these terms, please don't use the service.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            osschat is an open source AI chat platform that provides access to various AI models through OpenRouter. We offer:
          </p>
          <ul className="space-y-2 text-muted-foreground ml-4 list-disc">
            <li>A free tier with daily usage limits</li>
            <li>The ability to connect your own OpenRouter API key for unlimited access</li>
            <li>Chat history storage and retrieval</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">3. Account Registration</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            To use osschat, you must sign in with a GitHub account. You are responsible for:
          </p>
          <ul className="space-y-2 text-muted-foreground ml-4 list-disc">
            <li>Maintaining the security of your GitHub account</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized use</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            You agree not to use osschat to:
          </p>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-5">
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <svg className="size-5 text-destructive shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Generate illegal, harmful, or abusive content</span>
              </li>
              <li className="flex gap-2">
                <svg className="size-5 text-destructive shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Harass, threaten, or harm others</span>
              </li>
              <li className="flex gap-2">
                <svg className="size-5 text-destructive shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Attempt to bypass usage limits or security measures</span>
              </li>
              <li className="flex gap-2">
                <svg className="size-5 text-destructive shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Distribute malware or engage in phishing</span>
              </li>
              <li className="flex gap-2">
                <svg className="size-5 text-destructive shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Violate any applicable laws or regulations</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">5. AI-Generated Content</h2>
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-5">
            <p className="text-muted-foreground mb-3">Please understand that:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <svg className="size-5 text-warning shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>AI responses may contain errors, inaccuracies, or biases</span>
              </li>
              <li className="flex gap-2">
                <svg className="size-5 text-warning shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>You are responsible for verifying AI-generated information</span>
              </li>
              <li className="flex gap-2">
                <svg className="size-5 text-warning shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>AI responses should not be considered professional advice</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">6. Free Tier Limitations</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The free tier is subject to daily usage limits. We reserve the right to:
          </p>
          <ul className="space-y-2 text-muted-foreground ml-4 list-disc">
            <li>Modify usage limits at any time</li>
            <li>Restrict access for users who abuse the free tier</li>
            <li>Prioritize service for users with their own API keys during high demand</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">7. Your Content</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            You retain ownership of the content you create through osschat. By using our service, you grant us a limited license to:
          </p>
          <ul className="space-y-2 text-muted-foreground ml-4 list-disc">
            <li>Store your conversations for your access</li>
            <li>Process your messages through AI providers</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            We do not use your content to train AI models or share it with third parties except as necessary to provide the service.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">8. Third-Party Services</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            osschat integrates with third-party services:
          </p>
          <div className="grid gap-3">
            <div className="rounded-lg border bg-card p-4">
              <span className="font-medium">OpenRouter</span>
              <span className="text-muted-foreground"> - AI model access</span>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <span className="font-medium">GitHub</span>
              <span className="text-muted-foreground"> - Authentication</span>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <span className="font-medium">Convex</span>
              <span className="text-muted-foreground"> - Data storage</span>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Your use of these services is subject to their respective terms and privacy policies.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">9. Service Availability</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            We strive to maintain high availability but do not guarantee uninterrupted service. We may:
          </p>
          <ul className="space-y-2 text-muted-foreground ml-4 list-disc">
            <li>Perform maintenance with or without notice</li>
            <li>Modify or discontinue features</li>
            <li>Experience downtime due to third-party provider issues</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">10. Disclaimer of Warranties</h2>
          <p className="text-muted-foreground leading-relaxed">
            osschat is provided "as is" without warranties of any kind, either express or implied. We do not guarantee that the service will meet your requirements, be error-free or uninterrupted, or that AI responses will be accurate or appropriate.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">11. Limitation of Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the maximum extent permitted by law, osschat and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may suspend or terminate your access to osschat at any time for violations of these terms or for any other reason. You may delete your account at any time through the settings page.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">13. Changes to Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update these terms from time to time. Continued use of osschat after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">14. Contact</h2>
          <p className="text-muted-foreground">
            For questions about these terms, contact us on X at <a href="https://x.com/osschat" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@osschat</a>.
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
