'use client';

import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import { Card } from '@/components/ui/card';
import { spacing, opacity, borderRadius, transitions } from '@/styles/design-tokens';

const AI_PROVIDERS = [
	{ provider: 'openai', name: 'OpenAI', models: 'GPT-4o, o3-mini, GPT-4 Turbo' },
	{ provider: 'anthropic', name: 'Anthropic', models: 'Claude 3.5 Sonnet, Claude 3.5 Haiku' },
	{ provider: 'google', name: 'Google', models: 'Gemini 2.0 Flash, Gemini 2.0 Pro' },
	{ provider: 'deepseek', name: 'DeepSeek', models: 'DeepSeek R1, DeepSeek V3' },
	{ provider: 'xai', name: 'xAI', models: 'Grok 2, Grok 2.5' },
	{ provider: 'llama', name: 'Meta', models: 'Llama 3.3 70B, Llama 3.1' },
	{ provider: 'mistral', name: 'Mistral AI', models: 'Mistral Small 3, Codestral 2501' },
	{ provider: 'perplexity', name: 'Perplexity', models: 'Sonar, Sonar Pro' },
] as const;

export function AIModelsSection() {
	return (
		<section className="relative py-20 md:py-36">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.accent/6%)0%,transparent70%)] dark:bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.accent/10%)0%,transparent70%)]"
			/>
			<div className="@container mx-auto max-w-5xl px-6">
				<div className="text-center">
					<p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">
						AI Models
					</p>
					<h2 className="text-balance text-4xl font-bold lg:text-5xl">
						Chat with 100+ AI models
					</h2>
					<p className="mt-4 text-foreground/70">
						Access the best AI models from every major provider. Switch between models instantly—no separate subscriptions needed.
					</p>
				</div>
				<div className={`@min-4xl:grid-cols-4 @min-2xl:grid-cols-3 mx-auto mt-12 grid max-w-4xl grid-cols-2 md:mt-16 ${spacing.gap.lg} stagger-scale`}>
					{AI_PROVIDERS.map((item) => (
						<Card
						  key={item.provider}
						  className={`group flex flex-col items-center justify-center border-border/60 bg-card/${opacity.medium} py-8 text-center shadow-none backdrop-blur transition-all hover:scale-105 hover:border-border hover:shadow-lg ${borderRadius.lg} ${transitions.slow}`}
						>
						  <div className="flex h-12 items-center justify-center">
						    <ModelSelectorLogo
						      provider={item.provider}
						      className="h-10 w-auto dark:brightness-0 dark:invert"
						    />
						  </div>
						  <h3 className="mt-4 font-semibold text-foreground">{item.name}</h3>
						  <p className="mt-2 px-3 text-xs text-muted-foreground">{item.models}</p>
						</Card>
					))}
				</div>
				<div className="mt-12 text-center">
					<p className="text-sm text-muted-foreground">
						...and 90+ more models available in your dashboard
					</p>
				</div>
			</div>
		</section>
	);
}
