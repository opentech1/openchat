"use client";

import React, { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Database, Factory, Globe, HardDrive, Lock, PlugZap, Server, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TextEffect } from '@/components/ui/text-effect'
import { AnimatedGroup } from '@/components/ui/animated-group'
import { HeroHeader } from './header'
import type { Variants } from 'motion/react'
import { authClient } from '@openchat/auth/client'
import { captureClientEvent } from '@/lib/posthog'

const transitionVariants = {
    item: {
        hidden: {
            opacity: 0,
            filter: 'blur(12px)',
            y: 12,
        },
        visible: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: {
                type: 'spring',
                bounce: 0.3,
                duration: 1.5,
            },
        },
    },
} satisfies { item: Variants }

function screenWidthBucket(width: number) {
    if (width < 640) return 'xs'
    if (width < 768) return 'sm'
    if (width < 1024) return 'md'
    if (width < 1280) return 'lg'
    return 'xl'
}

export default function HeroSection() {
	const { data: session } = authClient.useSession()
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
		if (typeof session === 'undefined') return
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
			session_is_guest: !session?.user,
		})
	}, [session])

    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden">
                <div
                    aria-hidden
                    className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block">
                    <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
                    <div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
                    <div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
                </div>
                <section>
                    <div className="relative pt-24 md:pt-36">
                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: {
                                            delayChildren: 1,
                                        },
                                    },
                                },
                                item: {
                                    hidden: {
                                        opacity: 0,
                                        y: 20,
                                    },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        transition: {
                                            type: 'spring',
                                            bounce: 0.3,
                                            duration: 2,
                                        },
                                    },
                                },
                            }}
                            className="mask-b-from-35% mask-b-to-90% absolute inset-0 top-56 -z-20 lg:top-32">
                            <div
                                aria-hidden
                                className="hidden size-full dark:block [background:radial-gradient(80%_80%_at_50%_0%,hsl(0_0%_100%/0.04)_0%,transparent_60%),linear-gradient(180deg,transparent_0%,hsl(0_0%_0%/0.35)_100%)]"
                            />
                        </AnimatedGroup>

                        <div
                            aria-hidden
                            className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]"
                        />

                        <div className="mx-auto max-w-7xl px-6">
                            <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                                <AnimatedGroup variants={transitionVariants}>
                                    <Link
                                        href="/dashboard"
                                        className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5 dark:shadow-zinc-950">
                                        <span className="text-foreground text-sm">Open‑source • Privacy‑first • TypeScript</span>
                                        <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700"></span>

                                        <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                                            <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                                                <span className="flex size-6">
                                                    <ArrowRight className="m-auto size-3" />
                                                </span>
                                                <span className="flex size-6">
                                                    <ArrowRight className="m-auto size-3" />
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </AnimatedGroup>

                                <TextEffect
                                    preset="fade-in-blur"
                                    speedSegment={0.3}
                                    as="h1"
                                    className="mx-auto mt-8 max-w-4xl text-balance text-5xl max-md:font-semibold md:text-7xl lg:mt-16 xl:text-[5.25rem]">
                                    OpenChat — Open‑source AI chat platform
                                </TextEffect>
                                <TextEffect
                                    per="line"
                                    preset="fade-in-blur"
                                    speedSegment={0.3}
                                    delay={0.5}
                                    as="p"
                                    className="mx-auto mt-8 max-w-2xl text-balance text-lg">
                                    Embed a fast, secure, and fully customizable AI chat into your product. Batteries‑included auth, oRPC, and a Bun + Elysia API.
                                </TextEffect>

                                <AnimatedGroup
                                    variants={{
                                        container: {
                                            visible: {
                                                transition: {
                                                    staggerChildren: 0.05,
                                                    delayChildren: 0.75,
                                                },
                                            },
                                        },
                                        ...transitionVariants,
                                    }}
                                    className="mt-12 flex flex-col items-center justify-center gap-2 md:flex-row">
                                    <div
                                        key={1}
                                        className="bg-foreground/10 rounded-[calc(var(--radius-xl)+0.125rem)] border p-0.5">
                                        <Button
                                            asChild
                                            size="lg"
                                            className="rounded-xl px-5 text-base">
                                            <Link
                                                href="/dashboard"
                                                onClick={handleCtaClick('hero_try_openchat', 'Try OpenChat', 'hero')}>
                                                <span className="text-nowrap">Try OpenChat</span>
                                            </Link>
                                        </Button>
                                    </div>
                                    <Button
                                        key={2}
                                        asChild
                                        size="lg"
                                        variant="ghost"
                                        className="h-10.5 rounded-xl px-5">
                                        <Link
                                            href="/#demo"
                                            onClick={handleCtaClick('hero_request_demo', 'Request a demo', 'hero')}>
                                            <span className="text-nowrap">Request a demo</span>
                                        </Link>
                                    </Button>
                                </AnimatedGroup>
                            </div>
                        </div>

                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: {
                                            staggerChildren: 0.05,
                                            delayChildren: 0.75,
                                        },
                                    },
                                },
                                ...transitionVariants,
                            }}>
                            <div className="mask-b-from-55% relative -mr-56 mt-8 overflow-hidden px-2 sm:mr-0 sm:mt-12 md:mt-20">
                                <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background relative mx-auto max-w-6xl overflow-hidden rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1">
                                    <div className="aspect-15/8 relative rounded-2xl border border-border/25 bg-[linear-gradient(135deg,theme(colors.primary)_0%,theme(colors.primary/30%)_40%,transparent_100%),radial-gradient(120%_120%_at_70%_0%,theme(colors.accent/30%)_0%,transparent_70%)]" />
                                </div>
                            </div>
                        </AnimatedGroup>
                    </div>
                </section>
                <section className="bg-background pb-16 pt-16 md:pb-32">
                    <div className="group relative m-auto max-w-5xl px-6">
                        <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
                            <Link
                                href="/"
                                className="block text-sm duration-150 hover:opacity-75">
                                <span> Meet Our Customers</span>

                                <ChevronRight className="ml-1 inline-block size-3" />
                            </Link>
                        </div>
                        <div className="group-hover:blur-xs mx-auto mt-12 grid max-w-2xl grid-cols-4 gap-x-12 gap-y-8 transition-all duration-500 group-hover:opacity-50 sm:gap-x-16 sm:gap-y-14">
                            <div className="flex">
                                <img
                                    className="mx-auto h-5 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/nvidia.svg"
                                    alt="Nvidia Logo"
                                    height="20"
                                    width="auto"
                                />
                            </div>

                            <div className="flex">
                                <img
                                    className="mx-auto h-4 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/column.svg"
                                    alt="Column Logo"
                                    height="16"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-4 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/github.svg"
                                    alt="GitHub Logo"
                                    height="16"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-5 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/nike.svg"
                                    alt="Nike Logo"
                                    height="20"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-5 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/lemonsqueezy.svg"
                                    alt="Lemon Squeezy Logo"
                                    height="20"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-4 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/laravel.svg"
                                    alt="Laravel Logo"
                                    height="16"
                                    width="auto"
                                />
                            </div>
                            <div className="flex">
                                <img
                                    className="mx-auto h-7 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/lilly.svg"
                                    alt="Lilly Logo"
                                    height="28"
                                    width="auto"
                                />
                            </div>

                            <div className="flex">
                                <img
                                    className="mx-auto h-6 w-fit dark:invert"
                                    src="https://html.tailus.io/blocks/customers/openai.svg"
                                    alt="OpenAI Logo"
                                    height="24"
                                    width="auto"
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            {/* Features */}
            <section id="features" className="bg-background py-20 md:py-28 scroll-mt-24">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl font-semibold md:text-4xl">Everything you need to ship chat</h2>
                        <p className="text-muted-foreground mt-4">OpenChat ships a full stack: typed APIs, auth, real‑time sync, and a modern UI. Bring your own model or provider.</p>
                    </div>
                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl border p-6">
                            <div className="text-primary mb-3 inline-flex rounded-md bg-primary/10 p-2"><PlugZap className="size-5" /></div>
                            <h3 className="font-medium">Typed oRPC API</h3>
                            <p className="text-muted-foreground mt-2">End‑to‑end types with oRPC + TanStack Query for effortless data fetching.</p>
                        </div>
                        <div className="rounded-xl border p-6">
                            <div className="text-primary mb-3 inline-flex rounded-md bg-primary/10 p-2"><Lock className="size-5" /></div>
                            <h3 className="font-medium">Batteries‑included auth</h3>
                            <p className="text-muted-foreground mt-2">Better‑Auth with secure sessions and user management out of the box.</p>
                        </div>
                        <div className="rounded-xl border p-6">
                            <div className="text-primary mb-3 inline-flex rounded-md bg-primary/10 p-2"><Database className="size-5" /></div>
                            <h3 className="font-medium">Real‑time + offline</h3>
                            <p className="text-muted-foreground mt-2">Electric SQL keeps your UI in sync and resilient, even on flaky networks.</p>
                        </div>
                        <div className="rounded-xl border p-6">
                            <div className="text-primary mb-3 inline-flex rounded-md bg-primary/10 p-2"><Server className="size-5" /></div>
                            <h3 className="font-medium">Bun + Elysia server</h3>
                            <p className="text-muted-foreground mt-2">Fast API runtime with Elysia on Bun, tuned for low latency streaming.</p>
                        </div>
                        <div className="rounded-xl border p-6">
                            <div className="text-primary mb-3 inline-flex rounded-md bg-primary/10 p-2"><Globe className="size-5" /></div>
                            <h3 className="font-medium">Bring your own LLM</h3>
                            <p className="text-muted-foreground mt-2">Use the AI SDK and OpenRouter to connect to the models you prefer.</p>
                        </div>
                        <div className="rounded-xl border p-6">
                            <div className="text-primary mb-3 inline-flex rounded-md bg-primary/10 p-2"><Factory className="size-5" /></div>
                            <h3 className="font-medium">Team features</h3>
                            <p className="text-muted-foreground mt-2">Admin controls, roles, and audit trails designed for product teams.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="bg-muted/50 py-20 md:py-28 scroll-mt-24">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl font-semibold md:text-4xl">How it works</h2>
                        <p className="text-muted-foreground mt-4">A simple, reliable pipeline from UI to model.</p>
                    </div>
                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border bg-background p-6">
                            <span className="text-xs text-muted-foreground">01</span>
                            <h3 className="mt-2 font-medium">Next.js 15 UI</h3>
                            <p className="text-muted-foreground mt-2">Modern React 19 UI with shadcn components and streaming UX.</p>
                        </div>
                        <div className="rounded-xl border bg-background p-6">
                            <span className="text-xs text-muted-foreground">02</span>
                            <h3 className="mt-2 font-medium">oRPC client</h3>
                            <p className="text-muted-foreground mt-2">Type‑safe calls from the web to your Bun + Elysia API.</p>
                        </div>
                        <div className="rounded-xl border bg-background p-6">
                            <span className="text-xs text-muted-foreground">03</span>
                            <h3 className="mt-2 font-medium">Electric + Postgres</h3>
                            <p className="text-muted-foreground mt-2">Data syncs in real time, with local reads and optimistic updates.</p>
                        </div>
                        <div className="rounded-xl border bg-background p-6">
                            <span className="text-xs text-muted-foreground">04</span>
                            <h3 className="mt-2 font-medium">AI SDK providers</h3>
                            <p className="text-muted-foreground mt-2">Connect to OpenRouter or your own models with a small config.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing overview */}
            <section id="pricing" className="bg-background py-20 md:py-28 scroll-mt-24">
                <div className="mx-auto max-w-4xl px-6 text-center">
                    <h2 className="text-3xl font-semibold md:text-4xl">Simple pricing</h2>
                    <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
                        It’s free for individuals and small teams. Companies can pay for advanced team management, SSO, and enterprise controls. Prefer control? You can also self‑host.
                    </p>
                    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link href="/dashboard" className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium hover:bg-primary/90">
                            Get started free
                            <ArrowRight className="size-4" />
                        </Link>
                        <Link
                            href="https://github.com/opentech1/openchat/tree/main/docs/deployment"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm hover:text-foreground hover:bg-accent"
                        >
                            Self‑host guide
                        </Link>
                    </div>
                    <div className="mx-auto mt-8 max-w-md text-left">
                        <div className="grid gap-2">
                            <div className="flex items-start gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 text-primary" /> Unlimited messages for personal use</div>
                            <div className="flex items-start gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 text-primary" /> Team workspaces and roles</div>
                            <div className="flex items-start gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 text-primary" /> BYO LLM provider and keys</div>
                            <div className="flex items-start gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 text-primary" /> Self‑host with Docker Compose</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Self hosting */}
            <section id="self-hosting" className="bg-muted/50 py-20 md:py-28 scroll-mt-24">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="grid items-center gap-8 md:grid-cols-2">
                        <div>
                            <h2 className="text-3xl font-semibold md:text-4xl">Self‑host in minutes</h2>
                            <p className="text-muted-foreground mt-4">Use the included Docker Compose and deployment guides. Point to your Postgres, set `CORS_ORIGIN`, and you’re off.</p>
                            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-start gap-2"><HardDrive className="mt-0.5 size-4 text-primary" /> Works behind load balancers with <code className="rounded bg-accent px-1">ELECTRIC_SERVICE_URL</code></div>
                                <div className="flex items-start gap-2"><Server className="mt-0.5 size-4 text-primary" /> Bun + Elysia API with oRPC</div>
                                <div className="flex items-start gap-2"><Database className="mt-0.5 size-4 text-primary" /> Postgres + Electric SQL sync</div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <Link
                                    href="https://github.com/opentech1/openchat"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium hover:bg-primary/90"
                                >
                                    View repository
                                </Link>
                                <Link
                                    href="https://github.com/opentech1/openchat/blob/main/docker-compose.yml"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm hover:text-foreground hover:bg-accent"
                                >
                                    docker-compose.yml
                                </Link>
                            </div>
                        </div>
                        <div className="bg-background rounded-xl border p-4">
                            <pre className="overflow-auto rounded-lg bg-black/90 p-4 text-left text-xs text-white">
                                <code>{`git clone https://github.com/opentech1/openchat
cd openchat
cp .env.example .env && cp apps/server/.env.example apps/server/.env
# edit env files for DB + origins
docker compose up --build`}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            </section>

            {/* Demo anchor */}
            <section id="demo" className="bg-background py-16 scroll-mt-24">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="rounded-xl border bg-muted/40 p-8 text-center">
                        <h3 className="text-xl font-medium">Want a walkthrough?</h3>
                        <p className="text-muted-foreground mt-2">Open the dashboard and start a new chat to see the streaming UX.</p>
                        <div className="mt-4">
                            <Link href="/dashboard" className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90">
                                Open dashboard
                                <ArrowRight className="size-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* About + Footer */}
            <section id="about" className="bg-muted/50 py-16 scroll-mt-24">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div>
                            <h3 className="text-xl font-semibold">About OpenChat</h3>
                            <p className="text-muted-foreground mt-2">OpenChat is an open‑source AI chat platform. It’s built with Next.js 15, Bun + Elysia, oRPC, and Electric SQL. Use it as a product‑ready template or as a reference for your own stack.</p>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold">License</h3>
                            <p className="text-muted-foreground mt-2">AGPL‑3.0 © 2025 OpenChat. You can self‑host and modify under the terms of the license.</p>
                        </div>
                    </div>
                    <hr className="my-8 border-border/60" />
                    <footer className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <p className="text-muted-foreground text-sm">© 2025 OpenChat. All rights reserved.</p>
                        <div className="flex items-center gap-4 text-sm">
                            <Link href="https://github.com/opentech1/openchat" target="_blank" rel="noopener noreferrer" className="hover:text-accent-foreground">GitHub</Link>
                            <Link href="#pricing" className="hover:text-accent-foreground">Pricing</Link>
                            <Link href="#self-hosting" className="hover:text-accent-foreground">Self‑host</Link>
                        </div>
                    </footer>
                </div>
            </section>
        </>
    )
}
