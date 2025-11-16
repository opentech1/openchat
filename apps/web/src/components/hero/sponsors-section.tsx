'use client';

import { memo } from 'react';
import Image from 'next/image';
import { spacing, opacity, borderRadius, transitions } from '@/styles/design-tokens';

type Sponsor = {
	name: string;
	subtitle: string;
	href: string;
	logoLight?: string;
	logoDark?: string;
	logo?: string;
};

const SPONSORS: Sponsor[] = [
	{
		name: 'Convex',
		subtitle: 'Realtime backend',
		href: 'https://convex.dev/referral/LEOPLA6358',
		logoLight: 'https://github.com/user-attachments/assets/d80d057b-e651-49c3-a0eb-ee324274d549',
		logoDark: 'https://github.com/user-attachments/assets/04dee790-d23a-4aed-93bb-5943e7f9cd5c',
	},
	{
		name: 'Greptile',
		subtitle: 'AI code search',
		href: 'https://app.greptile.com/signup?ref=NTE2NTItMzUzNTg=',
		logo: 'https://github.com/user-attachments/assets/0dc5a5c7-2196-4270-b609-ea5a40f7e13e',
	},
	{
		name: 'GitBook',
		subtitle: 'Documentation platform',
		href: 'https://www.gitbook.com',
		logo: 'https://github.com/user-attachments/assets/ef2d2c18-0b94-424c-af39-cd40e0238665',
	},
	{
		name: 'Sentry',
		subtitle: 'Error monitoring',
		href: 'https://sentry.io',
		logo: 'https://github.com/user-attachments/assets/26266fa9-67a0-4256-9530-614f7ca4d2f5',
	},
	{
		name: 'Graphite',
		subtitle: 'Stacked PRs',
		href: 'https://graphite.dev',
		logoLight: '/sponsors/graphite-black.png',
		logoDark: '/sponsors/graphite-white.png',
	},
];

export const SponsorsSection = memo(function SponsorsSection() {
	return (
		<section className="bg-muted/30 relative py-20 md:py-36">
			<div className="@container mx-auto max-w-5xl px-6">
				<div className="text-center">
					<h2 className="text-balance text-4xl font-semibold lg:text-5xl">Proudly sponsored by</h2>
					<p className="mt-4 text-muted-foreground">
						Built with support from industry-leading companies
					</p>
				</div>
				<div className={`@min-4xl:grid-cols-2 mx-auto mt-12 grid max-w-3xl grid-cols-1 md:mt-16 ${spacing.gap.lg}`}>
					{SPONSORS.map((sponsor) => (
						<a
						  key={sponsor.name}
						  href={sponsor.href}
						  target="_blank"
						  rel="noopener noreferrer"
						  className={`group flex flex-col items-center justify-center border border-border/60 bg-card/${opacity.medium} px-8 py-12 backdrop-blur transition-all hover:scale-105 hover:border-border hover:shadow-2xl ${borderRadius.lg} ${transitions.slow}`}
						>
						  <div className="relative flex h-24 w-full max-w-[240px] items-center justify-center">
						    {sponsor.logoLight && sponsor.logoDark ? (
						      <>
						        <Image
						          src={sponsor.logoLight}
						          alt={`${sponsor.name} logo`}
						          width={240}
						          height={90}
						          className="h-auto w-full object-contain dark:hidden"
						          loading="lazy"
						        />
						        <Image
						          src={sponsor.logoDark}
						          alt={`${sponsor.name} logo`}
						          width={240}
						          height={90}
						          className="hidden h-auto w-full object-contain dark:block"
						          loading="lazy"
						        />
						      </>
						    ) : (
						      <Image
						        src={sponsor.logo!}
						        alt={`${sponsor.name} logo`}
						        width={240}
						        height={90}
						        className="h-auto w-full object-contain"
						        loading="lazy"
						      />
						    )}
						  </div>
						  <p className="mt-4 text-center text-sm text-muted-foreground">{sponsor.subtitle}</p>
						</a>
					))}
				</div>
			</div>
		</section>
	);
});
