"use client";

import React, { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
	ArrowRight,
	Database,
	GitBranch,
	Globe,
	PlugZap,
	Server,
	ShieldCheck,
	Sparkles,
	Terminal,
	Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextEffect } from "@/components/ui/text-effect";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { HeroHeader } from "./header";
import type { Variants } from "motion/react";
import { authClient } from "@openchat/auth/client";
import { captureClientEvent } from "@/lib/posthog";

const transitionVariants = {
	item: {
		hidden: {
			opacity: 0,
			filter: "blur(12px)",
			y: 12,
		},
		visible: {
			opacity: 1,
			filter: "blur(0px)",
			y: 0,
			transition: {
				type: "spring",
				bounce: 0.3,
				duration: 1.5,
			},
		},
	},
} satisfies { item: Variants };

function screenWidthBucket(width: number) {
	if (width < 640) return "xs";
	if (width < 768) return "sm";
	if (width < 1024) return "md";
	if (width < 1280) return "lg";
	return "xl";
}

type HighlightCard = {
	icon: LucideIcon;
	title: string;
	description: string;
	detail: string;
};

const highlights: HighlightCard[] = [
	{
		title: "Realtime sync via ElectricSQL",
		description:
			"The Bun + Elysia API proxies Electric shape requests so chats and messages stream into the UI within milliseconds, even when Postgres hiccups.",
		detail: "apps/server/src/app.ts · Electric fallback + publish/subscribe",
		icon: PlugZap,
	},
	{
		title: "Typed oRPC everywhere",
		description:
			"TanStack Query on the web client and server components both share the same oRPC contract, so you call serverClient.chats.create() with full type safety.",
		detail: "apps/web/src/utils/orpc*.ts · apps/server/src/routers",
		icon: Server,
	},
	{
		title: "Better Auth + guest bridging",
		description:
			"Anonymous visitors get a guest workspace instantly, and Better Auth upgrades the session without losing history or analytics context.",
		detail: "packages/auth · apps/web/src/lib/guest.*",
		icon: ShieldCheck,
	},
	{
		title: "Composable UI system",
		description:
			"Next.js 15, Tailwind v4, shadcn/ui, and the shared chat components power the dashboard, marketing site, and browser extension.",
		detail: "apps/web/src/components · apps/extension",
		icon: Sparkles,
	},
];

type WorkflowStep = {
	icon: LucideIcon;
	title: string;
	meta: string;
	description: string;
};

const workflowSteps: WorkflowStep[] = [
	{
		title: "Capture & compose",
		meta: "apps/web/src/components/chat-composer.tsx",
		description:
			"Streaming React Server Components hydrate instantly, while the TanStack-powered composer keeps optimistic messages snappy on every device.",
		icon: Sparkles,
	},
	{
		title: "Dispatch typed commands",
		meta: "apps/web/src/utils/orpc.ts",
		description:
			"ORPC clients sign each request with Better Auth or a guest header and automatically fail over to the fallback server URL when needed.",
		icon: Server,
	},
	{
		title: "Persist & replicate",
		meta: "apps/server/src/routers · ElectricSQL",
		description:
			"The Bun API writes to Postgres through Drizzle and immediately fans out WebSocket + Electric shape events so every tab updates together.",
		icon: Database,
	},
	{
		title: "Observe & govern",
		meta: "@/lib/posthog · packages/auth",
		description:
			"PostHog captures every CTA click, while role-aware policies keep AGPL-compliant audit trails for enterprise workspaces.",
		icon: Users,
	},
];

type WorkspaceSummary = {
	name: string;
	stack: string;
	detail: string;
};

const workspaceSummaries: WorkspaceSummary[] = [
	{
		name: "apps/web",
		stack: "Next.js 15 · Tailwind v4 · shadcn/ui",
		detail:
			"Landing pages, the dashboard, and the AI chat room live under src/app with server components, edge streaming, and TanStack Query.",
	},
	{
		name: "apps/server",
		stack: "Bun 1.2 · Elysia · oRPC · Drizzle",
		detail:
			"Routers live in src/routers, Electric proxies run in src/app.ts, and Better Auth + guest bridging keep every request isolated.",
	},
	{
		name: "apps/extension",
		stack: "WXT · React · shared chat UI",
		detail:
			"The browser extension reuses chat composer primitives so support teams can reply inside Zendesk, Intercom, or any tab.",
	},
	{
		name: "packages/auth",
		stack: "Better Auth · oRPC clients",
		detail:
			"Shared auth hooks, guest ID utilities, and PostHog helpers keep the monorepo consistent across web, server, and extension surfaces.",
	},
];

type HostingOption = {
	icon: LucideIcon;
	title: string;
	description: string;
	list: string[];
};

const hostingOptions: HostingOption[] = [
	{
		title: "Local dev in seconds",
		description: "Use Bun everywhere. Turbo spins up both apps, and Electric is optional while you tinker.",
		list: [
			"bun install && bun dev",
			"bun dev:web for Next.js, bun dev:server for the Bun API",
			"bun db:push seeds schema changes",
		],
		icon: Terminal,
	},
	{
		title: "Managed cloud",
		description: "Deploy the web app to Vercel or Fly, point the Bun API at Railway or Render, and keep ElectricSQL behind your edge proxy.",
		list: [
			"apps/web/railway.toml + docs/deployment",
			"NEXT_PUBLIC_SERVER_URL guides the client",
			"PostHog + Better Auth stay in step in any region",
		],
		icon: Globe,
	},
	{
		title: "Self-host & extend",
		description: "OpenChat ships under AGPLv3, so you can fork, add custom routers, or bring your own LLM gateway and still stay upstream-ready.",
		list: [
			"docker-compose.yml boots the full stack",
			"apps/server/src/routers is fully typed—add your own endpoints",
			"packages/auth publishes guest/session helpers for other apps",
		],
		icon: GitBranch,
	},
];

type PricingTier = {
	icon: LucideIcon;
	title: string;
	pill: string;
	description: string;
	items: string[];
};

const pricingTiers: PricingTier[] = [
	{
		title: "Community",
		pill: "Free forever",
		description: "Launch personal copilots or embed OpenChat into your product without swiping a card.",
		items: [
			"Unlimited chats, rooms, and guest seats",
			"Access to the entire monorepo + AGPL protections",
			"Bring your own OpenRouter or local model",
		],
		icon: Sparkles,
	},
	{
		title: "Teams",
		pill: "Contact us",
		description: "Companies fund the roadmap when they need advanced governance and team management controls.",
		items: [
			"Role-based workspaces + shared prompts",
			"SAML/SSO, audit exports, data retention policies",
			"Priority support and roadmap influence",
		],
		icon: ShieldCheck,
	},
	{
		title: "Self-host",
		pill: "BYO infra",
		description: "Prefer to run it yourself? Keep your data in your VPC and still upstream improvements via PR.",
		items: [
			"docker-compose.yml + docs/deployment",
			"Bun server + ElectricSQL ready for air-gapped installs",
			"Swap in custom storage, auth, or LLM providers",
		],
		icon: GitBranch,
	},
];

export default function HeroSection() {
	const { data: session } = authClient.useSession();
	const visitTrackedRef = useRef(false);

	const handleCtaClick = useCallback((ctaId: string, ctaCopy: string, section: string) => {
		return () => {
			const width = typeof window !== "undefined" ? window.innerWidth : 0;
			captureClientEvent("marketing.cta_clicked", {
				cta_id: ctaId,
				cta_copy: ctaCopy,
				section,
				screen_width_bucket: screenWidthBucket(width),
			});
		};
	}, []);

	useEffect(() => {
		if (visitTrackedRef.current) return;
		if (typeof session === "undefined") return;
		visitTrackedRef.current = true;
		const referrerUrl = document.referrer && document.referrer.length > 0 ? document.referrer : "direct";
		let referrerDomain = "direct";
		if (referrerUrl !== "direct") {
			try {
				referrerDomain = new URL(referrerUrl).hostname;
			} catch {
				referrerDomain = "direct";
			}
		}
		let utmSource: string | null = null;
		try {
			const params = new URLSearchParams(window.location.search);
			const source = params.get("utm_source");
			if (source && source.length > 0) {
				utmSource = source;
			}
		} catch {
			utmSource = null;
		}
		const entryPath = window.location.pathname || "/";
		captureClientEvent("marketing.visit_landing", {
			referrer_url: referrerUrl,
			referrer_domain: referrerDomain,
			utm_source: utmSource ?? undefined,
			entry_path: entryPath,
			session_is_guest: !session?.user,
		});
	}, [session]);

	return (
		<>
			<HeroHeader />
			<main className="overflow-hidden">
				<div aria-hidden className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block">
					<div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
					<div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
					<div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
				</div>
				<section id="hero">
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
											type: "spring",
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

						<div aria-hidden className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]" />

						<div className="mx-auto max-w-7xl px-6">
							<div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
								<AnimatedGroup variants={transitionVariants}>
									<Link
										href="/dashboard"
										className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5 dark:shadow-zinc-950">
										<span className="text-foreground text-sm">Monorepo • Electric sync • Bun everywhere</span>
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
									Build the open-source AI workspace teams actually ship
								</TextEffect>
								<TextEffect
									per="line"
									preset="fade-in-blur"
									speedSegment={0.3}
									delay={0.5}
									as="p"
									className="mx-auto mt-8 max-w-2xl text-balance text-lg">
									OpenChat stitches together Next.js 15, Bun + Elysia, ElectricSQL, and Better Auth so you can embed a privacy-first AI chat into any surface.
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
									<div key={1} className="bg-foreground/10 rounded-[calc(var(--radius-xl)+0.125rem)] border p-0.5">
										<Button asChild size="lg" className="rounded-xl px-5 text-base">
											<Link href="/dashboard" onClick={handleCtaClick("hero_try_openchat", "Try OpenChat", "hero")}>
												<span className="text-nowrap">Launch the dashboard</span>
											</Link>
										</Button>
									</div>
									<Button key={2} asChild size="lg" variant="ghost" className="h-10.5 rounded-xl px-5">
										<Link href="/#demo" onClick={handleCtaClick("hero_request_demo", "See a demo", "hero")}>
											<span className="text-nowrap">See the stack in action</span>
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

				<section id="overview" className="bg-background pb-16 pt-16 md:pb-24">
					<div className="mx-auto max-w-6xl px-6">
						<div className="mx-auto max-w-3xl text-center">
							<p className="text-muted-foreground text-sm uppercase tracking-wide">One repo, every touchpoint</p>
							<h2 className="mt-4 text-balance text-3xl font-semibold md:text-4xl">Understand the surfaces you ship with OpenChat</h2>
							<p className="text-muted-foreground mt-4 text-base">
								Monorepo managed by Turborepo + Bun with dedicated apps for the marketing site, dashboard, Bun API, and browser extension. No mystery scaffolding—everything lives in the folders below.
							</p>
						</div>
						<div className="mt-12 grid gap-6 md:grid-cols-2">
							{workspaceSummaries.map((workspace) => (
								<article key={workspace.name} className="rounded-2xl border bg-card/50 p-6 shadow-sm">
									<div className="text-xs font-mono uppercase text-primary">{workspace.name}</div>
									<h3 className="mt-3 text-xl font-semibold">{workspace.stack}</h3>
									<p className="text-muted-foreground mt-3 text-sm leading-relaxed">{workspace.detail}</p>
								</article>
							))}
						</div>
					</div>
				</section>

				<section id="features" className="bg-muted/20 py-20">
					<div className="mx-auto max-w-6xl px-6">
						<div className="max-w-3xl">
							<p className="text-muted-foreground text-sm uppercase tracking-wide">Why technical teams adopt it</p>
							<h2 className="mt-4 text-3xl font-semibold md:text-4xl">Everything you need to launch a trustworthy AI co-pilot</h2>
							<p className="text-muted-foreground mt-4 text-base">
								These highlights come straight from the codebase you get on day one—no vaporware, no hidden SaaS.
							</p>
						</div>
						<div className="mt-12 grid gap-6 md:grid-cols-2">
							{highlights.map((item) => (
								<article key={item.title} className="rounded-2xl border bg-background/60 p-6 shadow-sm">
									<div className="flex items-center gap-3">
										<span className="bg-primary/10 text-primary inline-flex size-11 items-center justify-center rounded-xl border border-primary/30">
											<item.icon className="size-5" />
										</span>
										<div>
											<h3 className="text-xl font-semibold">{item.title}</h3>
											<p className="text-muted-foreground text-sm">{item.detail}</p>
										</div>
									</div>
									<p className="text-foreground mt-4 text-base leading-relaxed">{item.description}</p>
								</article>
							))}
						</div>
					</div>
				</section>

				<section id="workflow" className="bg-background py-20">
					<div className="mx-auto max-w-6xl px-6">
						<div className="max-w-2xl">
							<p className="text-muted-foreground text-sm uppercase tracking-wide">From keystroke to insight</p>
							<h2 className="mt-4 text-3xl font-semibold md:text-4xl">A transparent pipeline you can trace in Git</h2>
							<p className="text-muted-foreground mt-4 text-base">
								Every arrow below maps to a real directory. Follow the data, instrument it, or replace it entirely without breaking type safety.
							</p>
						</div>
						<div className="mt-12 grid gap-6 md:grid-cols-2">
							{workflowSteps.map((step, index) => (
								<div key={step.title} className="relative rounded-2xl border bg-card/40 p-6">
									<div className="flex items-center gap-3">
										<span className="bg-primary/10 text-primary inline-flex size-10 items-center justify-center rounded-full border border-primary/30 font-semibold">
											{index + 1}
										</span>
										<div>
											<p className="text-xs font-mono uppercase text-muted-foreground">{step.meta}</p>
											<h3 className="mt-1 text-xl font-semibold">{step.title}</h3>
										</div>
									</div>
									<p className="text-muted-foreground mt-4 text-base">{step.description}</p>
								</div>
							))}
						</div>
					</div>
				</section>

				<section id="demo" className="bg-muted/20 py-20">
					<div className="mx-auto max-w-6xl px-6">
						<div className="grid gap-12 lg:grid-cols-2">
							<div>
								<p className="text-muted-foreground text-sm uppercase tracking-wide">Live demo</p>
								<h2 className="mt-4 text-3xl font-semibold md:text-4xl">Typed commands, fallback-safe delivery</h2>
								<p className="text-muted-foreground mt-4 text-base">
									No mock APIs here. The snippet on the right is lifted directly from the utilities that power <code className="rounded bg-muted px-1 py-0.5 text-xs">/dashboard</code> and the extension.
								</p>
								<ul className="mt-8 list-disc space-y-3 pl-5 text-sm text-muted-foreground">
									<li>Guest users become full Better Auth sessions without changing IDs.</li>
									<li>ElectricSQL streams changes back into TanStack Query caches automatically.</li>
									<li>Fallback storage keeps chats online if Postgres or Electric blips.</li>
								</ul>
							</div>
							<div className="rounded-3xl border bg-background/70 p-6 shadow-xl shadow-zinc-900/10">
								<div className="text-xs font-mono uppercase text-muted-foreground">apps/web/src/utils/orpc-server.ts</div>
								<pre className="mt-4 rounded-2xl bg-zinc-950/90 p-5 text-sm text-zinc-100">
{`import { serverClient } from "@/utils/orpc-server";

export async function bootstrapChat(title: string) {
	const { id } = await serverClient.chats.create({ title });

	await serverClient.messages.send({
		chatId: id,
		userMessage: {
			content: "Summarize today's incident reports",
		},
	});

	return id;
}`}
								</pre>
							</div>
						</div>
					</div>
				</section>

				<section id="self-host" className="bg-background py-20">
					<div className="mx-auto max-w-6xl px-6">
						<div className="max-w-3xl">
							<p className="text-muted-foreground text-sm uppercase tracking-wide">Run it your way</p>
							<h2 className="mt-4 text-3xl font-semibold md:text-4xl">Choose the deployment path that matches your workflow</h2>
							<p className="text-muted-foreground mt-4 text-base">
								Whether you're hacking locally, deploying to managed infra, or rolling your own cluster, every script lives in the repo. No black boxes.
							</p>
						</div>
						<div className="mt-12 grid gap-6 md:grid-cols-3">
							{hostingOptions.map((option) => (
								<article key={option.title} className="rounded-2xl border bg-card/40 p-6">
									<div className="flex items-center gap-3">
										<span className="bg-primary/10 text-primary inline-flex size-11 items-center justify-center rounded-xl border border-primary/30">
											<option.icon className="size-5" />
										</span>
										<h3 className="text-xl font-semibold">{option.title}</h3>
									</div>
									<p className="text-muted-foreground mt-4 text-sm leading-relaxed">{option.description}</p>
								<ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
									{option.list.map((item) => (
										<li key={item} className="text-muted-foreground">{item}</li>
									))}
								</ul>
								</article>
							))}
						</div>
					</div>
				</section>

				<section id="pricing" className="bg-muted/20 py-20">
					<div className="mx-auto max-w-6xl px-6">
						<div className="max-w-3xl">
							<p className="text-muted-foreground text-sm uppercase tracking-wide">Pricing without surprises</p>
							<h2 className="mt-4 text-3xl font-semibold md:text-4xl">Free to build, optional upgrades when teams need them</h2>
							<p className="text-muted-foreground mt-4 text-base">
								OpenChat is free for builders, hobby projects, and startups. Companies only pay when they need advanced team management features, audit controls, or someone to help run production. Or fork it and self-host under the AGPL—your call.
							</p>
						</div>
						<div className="mt-12 grid gap-6 md:grid-cols-3">
							{pricingTiers.map((tier) => (
								<article key={tier.title} className="flex h-full flex-col rounded-2xl border bg-background/70 p-6">
									<div className="flex items-center gap-3">
										<span className="bg-primary/10 text-primary inline-flex size-11 items-center justify-center rounded-xl border border-primary/30">
											<tier.icon className="size-5" />
										</span>
										<div>
											<p className="text-xs font-semibold uppercase tracking-wide text-primary">{tier.pill}</p>
											<h3 className="text-xl font-semibold">{tier.title}</h3>
										</div>
									</div>
									<p className="text-muted-foreground mt-4 text-sm leading-relaxed">{tier.description}</p>
								<ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
									{tier.items.map((item) => (
										<li key={item} className="text-muted-foreground">{item}</li>
									))}
								</ul>
								</article>
							))}
						</div>
						<div className="mt-12 flex flex-col gap-4 text-center sm:flex-row sm:justify-center">
							<Button asChild size="lg" className="rounded-2xl px-8">
								<Link href="/dashboard" onClick={handleCtaClick("pricing_cta_dashboard", "Start for free", "pricing")}>Start for free</Link>
							</Button>
							<Button asChild size="lg" variant="ghost" className="rounded-2xl px-8">
								<Link href="/#demo" onClick={handleCtaClick("pricing_cta_demo", "Talk to us", "pricing")}>
									Talk to us about teams
								</Link>
							</Button>
						</div>
					</div>
				</section>
			</main>
		</>
	);
}
