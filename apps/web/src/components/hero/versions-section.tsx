'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cloud, Server, Check } from 'lucide-react';
import { spacing, opacity, borderRadius, iconSize, transitions } from '@/styles/design-tokens';

const CLOUD_FEATURES = [
	'Live and ready now',
	'Completely free',
	'GitHub & Google OAuth',
	'No setup required',
	'Managed hosting & updates',
] as const;

const SELF_HOST_FEATURES = [
	'Coming soon',
	'Full source code available (AGPL v3)',
	'Deploy anywhere you want',
	'Complete control over your data',
	'Docker Compose ready',
] as const;

export function VersionsSection() {
	return (
		<section id="pricing" className="relative py-20 md:py-36">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.primary/8%)0%,transparent70%)] dark:bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.primary/12%)0%,transparent70%)]"
			/>
			<div className="@container mx-auto max-w-5xl px-6">
				<div className="text-center">
					<h2 className="text-balance text-4xl font-semibold lg:text-5xl">Choose your version</h2>
					<p className="mt-4 text-muted-foreground">
						Start on OpenChat Cloud today or self-host later. Both options are completely free.
					</p>
				</div>
				<div className={`@min-4xl:grid-cols-2 mx-auto mt-12 grid max-w-4xl grid-cols-1 md:mt-16 ${spacing.gap.lg}`}>
					{/* OpenChat Cloud - Primary/Highlighted */}
					<Card
						className={`group relative border-2 border-primary/50 bg-card/${opacity.medium} shadow-lg backdrop-blur transition-all hover:border-primary hover:shadow-2xl ${transitions.slow}`}
					>
						<div className="absolute right-4 top-4">
						  <span className="bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground rounded-full">
						    Live Now
						  </span>
						</div>
						<CardHeader>
						  <div className="flex items-center gap-3">
						    <div className={`flex items-center justify-center bg-primary/10 p-3 ${borderRadius.lg}`}>
						      <Cloud className={`${iconSize.xl} text-primary`} aria-hidden />
						    </div>
						    <div>
						      <CardTitle>OpenChat Cloud</CardTitle>
						      <CardDescription className="mt-1">Free forever</CardDescription>
						    </div>
						  </div>
						</CardHeader>
						<CardContent>
						  <ul className={`flex flex-col ${spacing.gap.md}`}>
						    {CLOUD_FEATURES.map((feature) => (
						      <li key={feature} className="flex items-start gap-3">
						        <Check className="size-5 shrink-0 text-primary" aria-hidden />
						        <span className="text-sm text-foreground">{feature}</span>
						      </li>
						    ))}
						  </ul>
						  <Button asChild size="lg" className="mt-8 w-full">
						    <Link href="/dashboard">
						      <span>Start Chatting</span>
						    </Link>
						  </Button>
						</CardContent>
					</Card>

					{/* Self-Host - Secondary */}
					<Card
						className={`group border-border/60 bg-card/${opacity.medium} shadow-none backdrop-blur transition-all hover:border-border hover:shadow-lg ${transitions.slow}`}
					>
						<div className="absolute right-4 top-4">
						  <span className="bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground rounded-full">
						    Coming Soon
						  </span>
						</div>
						<CardHeader>
						  <div className="flex items-center gap-3">
						    <div className={`flex items-center justify-center bg-muted p-3 ${borderRadius.lg}`}>
						      <Server className={`${iconSize.xl} text-foreground`} aria-hidden />
						    </div>
						    <div>
						      <CardTitle>Self-Host</CardTitle>
						      <CardDescription className="mt-1">Open source • Free</CardDescription>
						    </div>
						  </div>
						</CardHeader>
						<CardContent>
						  <ul className={`flex flex-col ${spacing.gap.md}`}>
						    {SELF_HOST_FEATURES.map((feature) => (
						      <li key={feature} className="flex items-start gap-3">
						        <Check className="size-5 shrink-0 text-muted-foreground" aria-hidden />
						        <span className="text-sm text-foreground">{feature}</span>
						      </li>
						    ))}
						  </ul>
						  <Button asChild size="lg" variant="outline" className="mt-8 w-full">
						    <Link
						      href="https://github.com/opentech1/openchat"
						      target="_blank"
						      rel="noopener noreferrer"
						    >
						      <span>View on GitHub</span>
						    </Link>
						  </Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</section>
	);
}
