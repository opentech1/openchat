"use client";

import { Github, MessageSquare, Users, Sparkles } from "@/lib/icons";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { signInWithGitHub } from "@/lib/auth-client";
import { useState, useEffect } from "react";

// Force dynamic rendering to ensure env vars are read at request time
export const dynamic = "force-dynamic";

// Star icon for GitHub stars
function StarIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
		</svg>
	);
}

// Stats type from our API
type PublicStats = {
	messages: number;
	users: number;
	chats: number;
	stars: number;
	models: number;
};

// Format large numbers nicely
function formatNumber(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return n.toString();
}

export default function SignInPage() {
	const [stats, setStats] = useState<PublicStats | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	// Fetch stats client-side
	useEffect(() => {
		const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
		if (!siteUrl) return;

		fetch(`${siteUrl}/stats`)
			.then((res) => res.ok ? res.json() : null)
			.then(setStats)
			.catch(() => null);
	}, []);

	const handleGitHubSignIn = async () => {
		setIsLoading(true);
		try {
			await signInWithGitHub("/");
		} catch (error) {
			console.error("Sign in failed:", error);
			setIsLoading(false);
		}
	};

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			{/* Left Column - Sign In Form */}
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link href="/" className="flex items-center gap-2 font-medium transition-opacity hover:opacity-80">
						<Logo size="small" />
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs space-y-6">
						<div className="space-y-1 text-center">
							<h1 className="text-xl font-semibold tracking-tight">Welcome to OpenChat</h1>
							<p className="text-muted-foreground text-sm">
								Sign in to access your workspace
							</p>
						</div>

						<div className="space-y-3">
							<button
								onClick={handleGitHubSignIn}
								disabled={isLoading}
								className="relative inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<Github className="size-5" />
								{isLoading ? "Signing in..." : "Continue with GitHub"}
							</button>
						</div>

						<p className="text-center text-xs text-muted-foreground">
							By continuing, you agree to our Terms of Service and Privacy Policy
						</p>
					</div>
				</div>
			</div>

			{/* Right Column - Gradient Background with Stats */}
			<div className="relative hidden lg:block overflow-hidden">
				{/* Gradient Background */}
				<div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-background" />

				{/* Decorative Elements */}
				<div className="absolute inset-0">
					{/* Large Gradient Orbs */}
					<div className="absolute -right-1/4 -top-1/4 size-[600px] rounded-full bg-gradient-to-br from-primary/30 to-transparent blur-3xl" />
					<div className="absolute -bottom-1/4 -left-1/4 size-[500px] rounded-full bg-gradient-to-tr from-primary/20 to-transparent blur-3xl" />

					{/* Grid Pattern Overlay */}
					<div
						className="absolute inset-0 opacity-[0.015]"
						style={{
							backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
						}}
					/>
				</div>

				{/* Content Overlay */}
				<div className="relative flex h-full flex-col items-center justify-center p-12">
					<div className="max-w-md text-center space-y-10">
						{/* Stats Grid */}
						<div className="grid grid-cols-2 gap-4">
							{/* Messages Stat */}
							<div className="rounded-2xl bg-primary/5 backdrop-blur-sm p-6 space-y-1">
								<div className="flex items-center justify-center gap-2 text-primary">
									<MessageSquare className="size-5" />
								</div>
								<div className="text-3xl font-bold tabular-nums">
									{stats ? formatNumber(stats.messages) : "—"}
								</div>
								<div className="text-xs text-muted-foreground">messages sent</div>
							</div>

							{/* Models Stat */}
							<div className="rounded-2xl bg-primary/5 backdrop-blur-sm p-6 space-y-1">
								<div className="flex items-center justify-center gap-2 text-primary">
									<Sparkles className="size-5" />
								</div>
								<div className="text-3xl font-bold tabular-nums">
									{stats ? `${stats.models}+` : "200+"}
								</div>
								<div className="text-xs text-muted-foreground">AI models</div>
							</div>

							{/* Users Stat */}
							<div className="rounded-2xl bg-primary/5 backdrop-blur-sm p-6 space-y-1">
								<div className="flex items-center justify-center gap-2 text-primary">
									<Users className="size-5" />
								</div>
								<div className="text-3xl font-bold tabular-nums">
									{stats ? formatNumber(stats.users) : "—"}
								</div>
								<div className="text-xs text-muted-foreground">users</div>
							</div>

							{/* GitHub Stars */}
							<div className="rounded-2xl bg-primary/5 backdrop-blur-sm p-6 space-y-1">
								<div className="flex items-center justify-center gap-2 text-primary">
									<StarIcon className="size-5" />
								</div>
								<div className="text-3xl font-bold tabular-nums">
									{stats?.stars ? formatNumber(stats.stars) : "—"}
								</div>
								<div className="text-xs text-muted-foreground">GitHub stars</div>
							</div>
						</div>

						{/* Tagline */}
						<div className="space-y-3">
							<p className="text-lg font-medium">
								One interface. Every AI model.
							</p>
							<p className="text-sm text-muted-foreground">
								GPT-4, Claude, Gemini, and 200+ more. Your keys, your privacy.
							</p>
						</div>

						{/* Provider Logos */}
						<div className="flex items-center justify-center gap-5 opacity-50">
							<img src="https://models.dev/logos/openai.svg" alt="OpenAI" className="h-4 dark:invert" />
							<img src="https://models.dev/logos/anthropic.svg" alt="Anthropic" className="h-4 dark:invert" />
							<img src="https://models.dev/logos/google.svg" alt="Google" className="h-4 dark:invert" />
							<img src="https://models.dev/logos/xai.svg" alt="xAI" className="h-4 dark:invert" />
							<img src="https://models.dev/logos/deepseek.svg" alt="DeepSeek" className="h-4 dark:invert" />
						</div>

						{/* Open Source Badge */}
						<a
							href="https://github.com/opentech1/openchat"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm transition-colors hover:bg-primary/20"
						>
							<Github className="size-4" />
							<span>100% Open Source</span>
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}
