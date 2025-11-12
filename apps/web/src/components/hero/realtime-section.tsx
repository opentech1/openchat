'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Zap, RefreshCw, Link as LinkIcon, Rocket } from 'lucide-react';
import type { ReactNode } from 'react';
import { spacing, opacity, iconSize, borderRadius, transitions } from '@/styles/design-tokens';

const REALTIME_FEATURES = [
	{
		icon: Zap,
		title: 'Streaming responses',
		description: 'Watch AI responses appear word-by-word as they generate. No waiting for complete answers.',
	},
	{
		icon: RefreshCw,
		title: 'Instant UI updates',
		description: 'Optimistic updates mean zero loading spinners. The interface reacts instantly to every action.',
	},
	{
		icon: LinkIcon,
		title: 'Live sync',
		description: 'Chat history syncs across all your devices and browser tabs in real-time. Always in sync.',
	},
	{
		icon: Rocket,
		title: 'Sub-second performance',
		description: 'Powered by Next.js 15, Convex realtime backend, and modern streaming APIs. Built for speed.',
	},
] as const;

const FeatureDecorator = ({ children }: { children: ReactNode }) => (
	<div className="mask-radial-from-40% mask-radial-to-60% relative mx-auto size-32 duration-200 [--color-border:color-mix(in_oklab,var(--color-zinc-950)12%,transparent)] group-hover:[--color-border:color-mix(in_oklab,var(--color-zinc-950)25%,transparent)] dark:[--color-border:color-mix(in_oklab,var(--color-white)18%,transparent)] dark:group-hover:[--color-border:color-mix(in_oklab,var(--color-white)30%,transparent)]">
		<div
			aria-hidden
			className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:20px_20px] opacity-60 dark:opacity-40"
		/>
		<div className={`bg-background absolute inset-0 m-auto flex size-12 items-center justify-center border border-border/60 ${borderRadius.full}`}>
			{children}
		</div>
	</div>
);

export function RealtimeSection() {
	return (
		<section className="bg-background relative py-20 md:py-36">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.primary/8%)0%,transparent70%)] dark:bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.primary/12%)0%,transparent70%)]"
			/>
			<div className="@container mx-auto max-w-5xl px-6">
				<div className="text-center">
					<h2 className="text-balance text-4xl font-semibold lg:text-5xl">Real-time everything</h2>
					<p className="mt-4 text-muted-foreground">
						Experience AI chat that feels instant
					</p>
				</div>
				<div className={`@min-4xl:grid-cols-2 mx-auto mt-12 grid max-w-3xl grid-cols-1 md:mt-16 ${spacing.gap.xl}`}>
					{REALTIME_FEATURES.map((feature) => {
						const Icon = feature.icon;
						return (
						  <Card
						    key={feature.title}
						    className={`group border-border/60 bg-card/${opacity.medium} shadow-none backdrop-blur transition-all ${transitions.slow} hover:border-border hover:shadow-lg`}
						  >
						    <CardHeader className="pb-3">
						      <FeatureDecorator>
						        <Icon className={iconSize.lg} aria-hidden />
						      </FeatureDecorator>
						      <h3 className="mt-6 font-semibold text-foreground">{feature.title}</h3>
						    </CardHeader>
						    <CardContent>
						      <p className="text-sm text-muted-foreground">{feature.description}</p>
						    </CardContent>
						  </Card>
						);
					})}
				</div>
			</div>
		</section>
	);
}
