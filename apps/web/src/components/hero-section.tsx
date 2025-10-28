'use client';

import type { Route } from 'next';
import React, { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@workos-inc/authkit-nextjs/components'

import { Button } from '@/components/ui/button'
import { HeroHeader } from './header'
import Features from '@/components/features-1'
import { InfiniteSlider } from '@/components/ui/infinite-slider'
import { ProgressiveBlur } from '@/components/ui/progressive-blur'
import { captureClientEvent } from '@/lib/posthog'
import { cn } from '@/lib/utils'

const TRUSTED_BRANDS = [
	"Nvidia",
	"Column",
	"GitHub",
	"Nike",
	"Lemon Squeezy",
	"Laravel",
	"Eli Lilly",
	"OpenAI",
];

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

function screenWidthBucket(width: number) {
	if (width < 640) return 'xs'
	if (width < 768) return 'sm'
	if (width < 1024) return 'md'
	if (width < 1280) return 'lg'
	return 'xl'
}

export default function HeroSection() {
	const { user } = useAuth()
	const visitTrackedRef = useRef(false)

	const handleCtaClick = useCallback((ctaId: string, ctaCopy: string, section: string) => {
		return () => {
			const width = typeof window !== 'undefined' ? window.innerWidth : 0
			captureClientEvent('marketing.cta_clicked', {
				cta_id: ctaId,
				cta_copy: ctaCopy,
				section,
				screen_width_bucket: screenWidthBucket(width),
			})
		}
	}, [])

	useEffect(() => {
		if (visitTrackedRef.current) return
		if (typeof user === 'undefined') return
		visitTrackedRef.current = true
		const referrerUrl = document.referrer && document.referrer.length > 0 ? document.referrer : 'direct'
		let referrerDomain = 'direct'
		if (referrerUrl !== 'direct') {
			try {
				referrerDomain = new URL(referrerUrl).hostname
			} catch {
				referrerDomain = 'direct'
			}
		}
		let utmSource: string | null = null
		try {
			const params = new URLSearchParams(window.location.search)
			const source = params.get('utm_source')
			if (source && source.length > 0) {
				utmSource = source
			}
		} catch {
			utmSource = null
		}
		const entryPath = window.location.pathname || '/'
		captureClientEvent('marketing.visit_landing', {
			referrer_url: referrerUrl,
			referrer_domain: referrerDomain,
			utm_source: utmSource ?? undefined,
			entry_path: entryPath,
			session_is_guest: !user,
		})
	}, [user])

    return (
        <>
            <HeroHeader />
            <main className="relative overflow-hidden">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                    <div className="absolute left-1/2 top-[-20%] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,theme(colors.primary/30%)0%,transparent70%)] [filter:blur(140px)]" />
                    <div className="absolute -right-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,theme(colors.accent/25%)0%,transparent70%)] [filter:blur(140px)]" />
                    <div className="absolute -left-32 bottom-[-10%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle_at_center,theme(colors.primary/25%)0%,transparent70%)] [filter:blur(140px)]" />
                    <div className="absolute inset-x-0 bottom-[-35%] h-[40rem] bg-[radial-gradient(60%_50%_at_50%_50%,theme(colors.background/0%)0%,theme(colors.background)70%)]" />
                </div>
                <section>
                    <div className="pb-24 pt-12 md:pb-32 lg:pb-56 lg:pt-44">
                        <div className="relative mx-auto flex max-w-6xl flex-col px-6 lg:block">
                            <div className="mx-auto max-w-xl text-center lg:ml-0 lg:w-1/2 lg:text-left">
                                <Link
                                    href="/dashboard"
                                    className="hover:bg-background group mx-auto flex w-fit items-center gap-3 rounded-full border px-4 py-1 text-[0.65rem] font-medium uppercase tracking-[0.35em] text-muted-foreground transition-colors duration-300 lg:mx-0"
                                    onClick={handleCtaClick('hero_try_openchat_badge', 'Try OpenChat', 'hero')}>
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
                                <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground lg:justify-start">
                                    <span className="rounded-full border px-4 py-2">Sub-second streaming interface</span>
                                    <span className="rounded-full border px-4 py-2">Tailwind v4 + shadcn styling</span>
                                    <span className="rounded-full border px-4 py-2">Self-host or OpenChat Cloud</span>
                                    <span className="rounded-full border px-4 py-2">Weekly community feature drops</span>
                                </div>

                                <div className="mt-12 flex flex-col items-center justify-center gap-2 sm:flex-row lg:justify-start">
                                    <Button
                                        asChild
                                        size="lg"
                                        className="px-5 text-base">
                                        <Link
                                            href="/dashboard"
                                            onClick={handleCtaClick('hero_try_openchat', 'Try OpenChat', 'hero')}>
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
                                            onClick={handleCtaClick('hero_request_demo', 'Request a demo', 'hero')}>
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
                <section className="bg-background pb-16 md:pb-32">
                    <div className="group relative m-auto max-w-6xl px-6">
                        <div className="flex flex-col items-center md:flex-row">
                            <div className="md:max-w-44 md:border-r md:pr-6">
                                <p className="text-end text-sm text-muted-foreground">Trusted by teams shipping with OpenChat</p>
                            </div>
                            <div className="relative py-6 md:w-[calc(100%-11rem)]">
                                <InfiniteSlider
                                    speedOnHover={26}
                                    speed={32}
                                    gap={96}
                                    className="pl-8 pr-8">
                                    {TRUSTED_BRANDS.map((brand) => (
                                        <div key={brand} className="flex">
                                            <span className="mx-auto whitespace-nowrap rounded-full border border-border/60 px-4 py-2 text-xs font-medium text-muted-foreground">
                                                {brand}
                                            </span>
                                        </div>
                                    ))}
                                </InfiniteSlider>

                                <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-linear-to-r from-background" />
                                <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-background" />
                                <ProgressiveBlur
                                    className="pointer-events-none absolute left-0 top-0 h-full w-20"
                                    direction="left"
                                    blurIntensity={1}
                                />
                                <ProgressiveBlur
                                    className="pointer-events-none absolute right-0 top-0 h-full w-20"
                                    direction="right"
                                    blurIntensity={1}
                                />
                            </div>
                        </div>
                    </div>
                </section>
                <Features />
                <section id="integrations" className="bg-muted/30 py-20 md:py-28">
                    <div className="mx-auto max-w-5xl px-6">
                        <div className="text-center">
                            <h2 className="text-balance text-3xl font-semibold md:text-4xl">Integrations that ship with you</h2>
                            <p className="mt-4 text-balance text-muted-foreground">
                                OpenChat bundles the production stack we use ourselves so you can focus on product, not plumbing.
                            </p>
                        </div>
                        <div className="mt-12 grid gap-6 md:grid-cols-3">
                            {INTEGRATIONS.map((item) => (
                                <div key={item.title} className="border-border/60 bg-card/90 rounded-2xl border p-5 shadow-sm backdrop-blur">
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
                <section id="pricing" className="py-20 md:py-32">
                    <div className="mx-auto max-w-5xl px-6">
                        <div className="text-center">
                            <h2 className="text-balance text-3xl font-semibold md:text-4xl">Choose how you run OpenChat</h2>
                            <p className="mt-4 text-balance text-muted-foreground">
                                Self-host for free or let us run the infrastructure. Either way you stay in control of your data.
                            </p>
                        </div>
						<div className="mt-12 grid gap-6 md:grid-cols-2">
							{PRICING_PLANS.map((plan) => {
								const isInternal = isInternalHref(plan.ctaHref)
								const isMailto = plan.ctaHref.startsWith('mailto:')

								return (
									<div
										key={plan.tier}
										className={cn(
											"border-border/60 bg-card/80 flex flex-col rounded-2xl border p-6 text-left shadow-sm backdrop-blur",
											plan.highlight && "border-primary/60 shadow-primary/10"
										)}
									>
										<div className="flex items-baseline justify-between gap-4">
											<h3 className="text-xl font-semibold">{plan.tier}</h3>
											<span className="text-primary text-sm font-semibold uppercase tracking-wide">{plan.price}</span>
										</div>
										<p className="mt-3 flex-1 text-sm text-muted-foreground">{plan.description}</p>
										<Button asChild size="sm" className="mt-6 w-full justify-center">
											{isInternal ? (
												<Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
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
								)
							})}
						</div>
                    </div>
                </section>
            </main>
        </>
    )
}
