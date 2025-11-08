'use client';

import type { Route } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { spacing } from '@/styles/design-tokens';

type HeroContentProps = {
  onCtaClick: (ctaId: string, ctaCopy: string, section: string) => () => void;
};

export function HeroContent({ onCtaClick }: HeroContentProps) {
  return (
    <section>
      <div className="pb-24 pt-12 md:pb-32 lg:pb-56 lg:pt-44">
        <div className="relative mx-auto flex max-w-6xl flex-col px-6 lg:block">
          <div className="mx-auto max-w-xl text-center lg:ml-0 lg:w-1/2 lg:text-left">
            <Link
              href="/dashboard"
              className={`hover:bg-background group mx-auto flex w-fit items-center rounded-full border px-4 py-1 text-[0.65rem] font-medium uppercase tracking-[0.35em] text-muted-foreground transition-colors duration-300 lg:mx-0 ${spacing.gap.md}`}
              onClick={onCtaClick('hero_try_openchat_badge', 'Try OpenChat', 'hero')}>
              <span>Lightning fast • Fully yours • Community built</span>
              <span className="inline-flex h-2 w-2 rounded-full bg-primary group-hover:scale-110 transition-transform" />
            </Link>
            <h1 className="mt-8 max-w-3xl text-balance text-5xl font-semibold md:text-6xl lg:mt-16 xl:text-[4.5rem]">
              Fast, flexible AI chat for everyone
            </h1>
            <p className="mt-6 max-w-3xl text-balance text-lg text-muted-foreground">
              OpenChat blends a sub-second streaming interface with Tailwind + shadcn customization and a community shipping fresh
              building blocks every week. Self-host it or flip the switch on OpenChat Cloud—either way you stay in control.
            </p>
            <div className={`mt-10 flex flex-wrap items-center justify-center text-sm text-muted-foreground lg:justify-start ${spacing.gap.md}`}>
              <span className="rounded-full border px-4 py-2">Sub-second streaming interface</span>
              <span className="rounded-full border px-4 py-2">Tailwind v4 + shadcn styling</span>
              <span className="rounded-full border px-4 py-2">Self-host or OpenChat Cloud</span>
              <span className="rounded-full border px-4 py-2">Weekly community feature drops</span>
            </div>

            <div className={`mt-12 flex flex-col items-center justify-center sm:flex-row lg:justify-start ${spacing.gap.sm}`}>
              <Button
                asChild
                size="lg"
                className="px-5 text-base">
                <Link
                  href="/dashboard"
                  onClick={onCtaClick('hero_try_openchat', 'Try OpenChat', 'hero')}>
                  <span className="text-nowrap">Try OpenChat</span>
                </Link>
              </Button>
              <Button
                key={2}
                asChild
                size="lg"
                variant="ghost"
                className="px-5 text-base">
                <Link
                  href="#pricing"
                  onClick={onCtaClick('hero_request_demo', 'Request a demo', 'hero')}>
                  <span className="text-nowrap">Request a demo</span>
                </Link>
              </Button>
            </div>
          </div>
          <div className="-z-10 order-first ml-auto mt-12 flex w-full max-w-3xl justify-center lg:absolute lg:bottom-[-6rem] lg:right-[-4rem] lg:top-auto lg:order-last lg:w-1/2 lg:max-w-none lg:justify-end">
            <Image
              className="hidden h-auto w-full max-w-2xl drop-shadow-2xl dark:block"
              src="/hero-preview-dark.svg"
              alt="OpenChat product overview in dark mode"
              height={900}
              width={1600}
              priority
              sizes="(min-width: 1280px) 640px, (min-width: 768px) 50vw, 90vw"
            />
            <Image
              className="block h-auto w-full max-w-2xl drop-shadow-xl dark:hidden"
              src="/hero-preview-light.svg"
              alt="OpenChat product overview in light mode"
              height={900}
              width={1600}
              priority
              sizes="(min-width: 1280px) 640px, (min-width: 768px) 50vw, 90vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
