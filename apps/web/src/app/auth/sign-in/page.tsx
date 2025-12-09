import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { Github, MessageSquare, Users, Sparkles } from "@/lib/icons";
import Link from "next/link";
import { Logo } from "@/components/logo";

// Force dynamic rendering to ensure env vars are read at request time
// This prevents ISR from caching a "not configured" state during builds
export const dynamic = "force-dynamic";

// Google icon component (not available in lucide-react)
function GoogleIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
			<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
			<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
			<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
		</svg>
	);
}

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

// Fetch stats server-side
async function fetchStats(): Promise<PublicStats | null> {
	try {
		const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
		if (!siteUrl) return null;
		const res = await fetch(`${siteUrl}/stats`, {
			next: { revalidate: 60 }, // Cache for 60 seconds
		});
		if (res.ok) {
			return await res.json();
		}
		return null;
	} catch {
		// Stats are optional, fail silently
		return null;
	}
}

export default async function SignInPage() {
	// Validate required environment variables
	const clientId = process.env.WORKOS_CLIENT_ID;
	const redirectUri = process.env.WORKOS_REDIRECT_URI;

	// If WorkOS is not configured, show a configuration required page
	const isConfigured = clientId && redirectUri;

	// Generate sign-in URL using AuthKit (handles state management properly)
	let signInUrl = "#";

	if (isConfigured) {
		signInUrl = await getSignInUrl();
	}

	// Fetch stats in parallel (doesn't require WorkOS)
	const stats = await fetchStats();

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

						{isConfigured ? (
							<>
								<div className="space-y-3">
									{/* Sign In Button - redirects to AuthKit hosted page */}
									<a
										href={signInUrl}
										className="relative inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
									>
										Sign In
									</a>
								</div>

								<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
									<Github className="size-3.5" />
									<span>•</span>
									<GoogleIcon className="size-3.5" />
									<span className="ml-1">OAuth available</span>
								</div>

								<p className="text-center text-xs text-muted-foreground">
									By continuing, you agree to our Terms of Service and Privacy Policy
								</p>
							</>
						) : (
							<div className="space-y-4 text-center">
								<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
									<p className="text-sm text-amber-600 dark:text-amber-400">
										Authentication is not configured. Please set the required WorkOS environment variables.
									</p>
									<ul className="mt-2 text-xs text-muted-foreground space-y-1">
										<li><code>WORKOS_CLIENT_ID</code></li>
										<li><code>WORKOS_REDIRECT_URI</code></li>
									</ul>
								</div>
								<a
									href="https://github.com/opentech1/openchat#authentication-setup"
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
								>
									View setup guide
								</a>
							</div>
						)}
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
