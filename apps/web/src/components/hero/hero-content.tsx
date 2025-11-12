'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import { spacing, borderRadius, opacity, transitions } from '@/styles/design-tokens';

type HeroContentProps = {
  onCtaClick: (ctaId: string, ctaCopy: string, section: string) => () => void;
};

const FEATURED_PROVIDERS = [
  { provider: 'openai', name: 'OpenAI' },
  { provider: 'anthropic', name: 'Anthropic' },
  { provider: 'google', name: 'Google' },
  { provider: 'deepseek', name: 'DeepSeek' },
  { provider: 'xai', name: 'xAI' },
  { provider: 'llama', name: 'Meta' },
  { provider: 'mistral', name: 'Mistral' },
  { provider: 'perplexity', name: 'Perplexity' },
] as const;

export function HeroContent({ onCtaClick }: HeroContentProps) {
  return (
    <section className="relative">
      <div className="pb-32 pt-24 md:pb-40 md:pt-32 lg:pb-48 lg:pt-40">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <Link
              href="/dashboard"
              className={`inline-flex items-center border px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground ${borderRadius.full} ${transitions.normal}`}
              onClick={onCtaClick('hero_badge', 'Hero Badge', 'hero')}
            >
              <span className={`mr-2 inline-flex size-2 ${borderRadius.full} bg-primary`} />
              Free • Open Source • 100+ Models
            </Link>

            {/* Main Headline */}
            <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold leading-tight tracking-tight md:text-6xl lg:text-7xl">
              Chat with every AI model in one place
            </h1>

            {/* Subheading */}
            <p className="mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
              Access GPT-4, Claude, Gemini, and 100+ other models through a blazing-fast interface. Fully open source. Completely free. No lock-in.
            </p>

            {/* CTAs */}
            <div className={`mt-8 flex flex-col items-center sm:flex-row ${spacing.gap.md}`}>
              <Button asChild size="lg" className="h-11 px-8">
                <Link href="/dashboard" onClick={onCtaClick('hero_start_chatting', 'Start Chatting', 'hero')}>
                  Start Chatting Free
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 px-8"
              >
                <Link
                  href="https://github.com/opentech1/openchat"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onCtaClick('hero_view_github', 'View GitHub', 'hero')}
                >
                  View on GitHub
                </Link>
              </Button>
            </div>

            {/* Stats Row */}
            <div className={`mt-12 flex flex-wrap items-center justify-center ${spacing.gap.lg}`}>
              <div className="flex flex-col items-center">
                <div className="text-4xl font-semibold text-foreground">100+</div>
                <div className="mt-1 text-sm text-muted-foreground">AI models</div>
              </div>
              <div className={`hidden h-8 w-px bg-border sm:block`} />
              <div className="flex flex-col items-center">
                <div className="text-4xl font-semibold text-foreground">&lt;1s</div>
                <div className="mt-1 text-sm text-muted-foreground">response time</div>
              </div>
              <div className={`hidden h-8 w-px bg-border sm:block`} />
              <div className="flex flex-col items-center">
                <div className="text-4xl font-semibold text-foreground">100%</div>
                <div className="mt-1 text-sm text-muted-foreground">open source</div>
              </div>
            </div>

            {/* Model Provider Logos */}
            <div className="mt-16 w-full">
              <div className="mb-8 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Powered by
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
                {FEATURED_PROVIDERS.map((item) => (
                  <div
                    key={item.provider}
                    className="flex items-center opacity-40 transition-opacity hover:opacity-100"
                    title={item.name}
                  >
                    <ModelSelectorLogo
                      provider={item.provider}
                      className="h-7 w-auto dark:brightness-0 dark:invert"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 text-xs text-muted-foreground">+ 90 more models available</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
