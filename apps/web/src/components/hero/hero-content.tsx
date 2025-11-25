'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';

type HeroContentProps = {
	onCtaClick: (ctaId: string, ctaCopy: string, section: string) => () => void;
};

const FEATURED_PROVIDERS = [
	{ provider: 'openai', name: 'OpenAI' },
	{ provider: 'anthropic', name: 'Anthropic' },
	{ provider: 'google', name: 'Google' },
	{ provider: 'deepseek', name: 'DeepSeek' },
	{ provider: 'xai', name: 'xAI' },
	{ provider: 'llama', name: 'Meta' },
	{ provider: 'mistral', name: 'Mistral' },
	{ provider: 'perplexity', name: 'Perplexity' },
] as const;

export function HeroContent({ onCtaClick }: HeroContentProps) {
	return (
		<section className="relative">
			<div className="pb-32 pt-24 md:pb-40 md:pt-32 lg:pb-48 lg:pt-40">
				<div className="mx-auto max-w-5xl px-6">
					<div className="flex flex-col items-center text-center">
						{/* Badge - Clean Linear style */}
						<Link
						  href="/dashboard"
						  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
						  onClick={onCtaClick('hero_badge', 'Hero Badge', 'hero')}
						>
						  <span className="inline-flex size-1.5 rounded-full bg-primary" />
						  Free • Open Source • 100+ Models
						</Link>

						{/* Main Headline - Large, bold, tight tracking */}
						<h1 className="mt-8 max-w-4xl text-balance text-6xl font-bold leading-[1.1] tracking-[-0.02em] md:text-7xl lg:text-8xl text-foreground">
						  Chat with every AI model in one place
						</h1>

						{/* Subheading - Clean and readable */}
						<p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
						  Access GPT-4, Claude, Gemini, and 100+ other models through a blazing-fast interface. Fully open source. Completely free. No lock-in.
						</p>

						{/* CTAs - Clean Linear style buttons */}
						<div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
						  <Button
						    asChild
						    size="lg"
						    className="h-11 px-6 text-base font-medium transition-transform active:scale-[0.98]"
						  >
						    <Link href="/dashboard" onClick={onCtaClick('hero_start_chatting', 'Start Chatting', 'hero')}>
						      Start Chatting Free
						    </Link>
						  </Button>
						  <Button
						    asChild
						    size="lg"
						    variant="outline"
						    className="h-11 px-6 text-base font-medium transition-transform active:scale-[0.98]"
						  >
						    <Link
						      href="https://github.com/opentech1/openchat"
						      target="_blank"
						      rel="noopener noreferrer"
						      onClick={onCtaClick('hero_view_github', 'View GitHub', 'hero')}
						    >
						      View on GitHub
						    </Link>
						  </Button>
						</div>

						{/* Stats Row - Clean and minimal */}
						<div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-12">
						  <div className="flex flex-col items-center">
						    <div className="text-5xl font-bold tracking-tight text-foreground">100+</div>
						    <div className="mt-2 text-sm font-medium text-muted-foreground">AI models</div>
						  </div>
						  <div className="flex flex-col items-center">
						    <div className="text-5xl font-bold tracking-tight text-foreground">&lt;1s</div>
						    <div className="mt-2 text-sm font-medium text-muted-foreground">response time</div>
						  </div>
						  <div className="flex flex-col items-center">
						    <div className="text-5xl font-bold tracking-tight text-foreground">100%</div>
						    <div className="mt-2 text-sm font-medium text-muted-foreground">open source</div>
						  </div>
						</div>

						{/* Model Provider Logos - Clean and simple */}
						<div className="mt-20 w-full">
						  <div className="mb-8 text-xs font-medium uppercase tracking-widest text-muted-foreground">
						    Powered by
						  </div>
						  <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
						    {FEATURED_PROVIDERS.map((item) => (
						      <div
						        key={item.provider}
						        className="opacity-60 transition-opacity hover:opacity-100"
						        title={item.name}
						      >
						        <ModelSelectorLogo
						          provider={item.provider}
						          className="h-7 w-auto dark:brightness-0 dark:invert"
						        />
						      </div>
						    ))}
						  </div>
						  <div className="mt-6 text-xs text-muted-foreground">+ 90 more models available</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
