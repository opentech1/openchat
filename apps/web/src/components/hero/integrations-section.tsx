'use client';

import { spacing, opacity } from '@/styles/design-tokens';

const INTEGRATIONS = [
  {
    title: "Authentication",
    description: "WorkOS AuthKit powers SSO, magic links, and workspace roles from day one.",
    tag: "WorkOS",
  },
  {
    title: "Models & Routing",
    description: "OpenRouter keeps you model agnostic with per-user keys, rate limits, and smart fallbacks.",
    tag: "OpenRouter",
  },
  {
    title: "Realtime Data",
    description: "Convex stores chats, handles optimistic updates, and fan-outs sidebar changes instantly.",
    tag: "Convex",
  },
];

export function IntegrationsSection() {
  return (
    <section id="integrations" className="bg-muted/30 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-semibold md:text-4xl">Integrations that ship with you</h2>
          <p className="mt-4 text-balance text-muted-foreground">
            OpenChat bundles the production stack we use ourselves so you can focus on product, not plumbing.
          </p>
        </div>
        <div className={`mt-12 grid md:grid-cols-3 ${spacing.gap.xl}`}>
          {INTEGRATIONS.map((item) => (
            <div key={item.title} className={`border-border/60 bg-card/${opacity.medium} rounded-2xl border p-5 shadow-sm backdrop-blur`}>
              <span className="text-primary/80 inline-flex items-center rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {item.tag}
              </span>
              <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
