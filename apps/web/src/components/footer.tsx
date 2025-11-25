'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { transitions } from '@/styles/design-tokens';

const FOOTER_LINKS = [
	{
		label: 'GitHub',
		href: 'https://github.com/opentech1/openchat',
		external: true,
	},
	{
		label: 'Documentation',
		href: '/docs',
		external: false,
	},
	{
		label: 'Discord',
		href: 'https://discord.gg/openchat',
		external: true,
	},
	{
		label: 'License (AGPL v3)',
		href: 'https://github.com/opentech1/openchat/blob/main/LICENSE',
		external: true,
	},
	{
		label: 'Contact',
		href: 'mailto:hello@openchat.dev',
		external: true,
	},
] as const;

export function Footer() {
	const currentYear = new Date().getFullYear();

	return (
		<footer className="relative bg-muted/80 backdrop-blur-sm py-16 md:py-20">
			<div className="absolute top-0 left-0 right-0 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
			<div className="mx-auto max-w-6xl px-6">
				<nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
					{FOOTER_LINKS.map((link) => {
						if (link.external) {
						  return (
						    <a
						      key={link.label}
						      href={link.href}
						      target="_blank"
						      rel="noopener noreferrer"
						      className={`text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline ${transitions.normal}`}
						    >
						      {link.label}
						    </a>
						  );
						}
						return (
						  <Link
						    key={link.label}
						    href={link.href as Route}
						    className={`text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline ${transitions.normal}`}
						  >
						    {link.label}
						  </Link>
						);
					})}
				</nav>
				<div className="mt-8 text-center">
					<p className="text-sm text-muted-foreground">
						© {currentYear} OpenChat. Open source under{' '}
						<a
						  href="https://github.com/opentech1/openchat/blob/main/LICENSE"
						  target="_blank"
						  rel="noopener noreferrer"
						  className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
						>
						  AGPL v3
						</a>
						.
					</p>
				</div>
			</div>
		</footer>
	);
}
