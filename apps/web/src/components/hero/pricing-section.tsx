'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { spacing, opacity } from '@/styles/design-tokens';

type PricingPlan = {
  tier: string;
  price: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
};

const PRICING_PLANS = [
  {
    tier: "Self-host",
    price: "$0",
    description: "MIT core. Deploy with Docker Compose, Fly, or Vercel. Bring your own OpenRouter key.",
    ctaLabel: "Read docs",
    ctaHref: "/docs",
  },
  {
    tier: "OpenChat Cloud",
    price: "Starting at $29/mo",
    description: "Managed hosting with analytics, alerts, and concierge onboarding. Cancel anytime.",
    ctaLabel: "Join waitlist",
    ctaHref: "mailto:hello@openchat.dev?subject=OpenChat%20Cloud%20waitlist",
    highlight: true,
  },
] satisfies PricingPlan[];

function isInternalHref(href: PricingPlan['ctaHref']): href is Route {
  return href.startsWith('/');
}

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-semibold md:text-4xl">Choose how you run OpenChat</h2>
          <p className="mt-4 text-balance text-muted-foreground">
            Self-host for free or let us run the infrastructure. Either way you stay in control of your data.
          </p>
        </div>
        <div className={`mt-12 grid md:grid-cols-2 ${spacing.gap.xl}`}>
          {PRICING_PLANS.map((plan) => {
            const isInternal = isInternalHref(plan.ctaHref);
            const isMailto = plan.ctaHref.startsWith('mailto:');

            return (
              <div
                key={plan.tier}
                className={cn(
                  `border-border/60 bg-card/${opacity.subtle} flex flex-col rounded-2xl border p-6 text-left shadow-sm backdrop-blur`,
                  plan.highlight && "border-primary/60 shadow-primary/10"
                )}
              >
                <div className={`flex items-baseline justify-between ${spacing.gap.lg}`}>
                  <h3 className="text-xl font-semibold">{plan.tier}</h3>
                  <span className="text-primary text-sm font-semibold uppercase tracking-wide">{plan.price}</span>
                </div>
                <p className="mt-3 flex-1 text-sm text-muted-foreground">{plan.description}</p>
                <Button asChild size="sm" className="mt-6 w-full justify-center">
                  {isInternal ? (
                    <Link href={plan.ctaHref as Route}>{plan.ctaLabel}</Link>
                  ) : (
                    <a
                      href={plan.ctaHref}
                      target={isMailto ? undefined : '_blank'}
                      rel={isMailto ? undefined : 'noreferrer'}
                    >
                      {plan.ctaLabel}
                    </a>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
