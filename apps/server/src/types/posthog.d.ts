declare module "posthog-node" {
	interface CaptureOptions {
		distinctId: string
		event: string
		properties?: Record<string, unknown>
	}

	interface PostHogOptions {
		host?: string
		flushAt?: number
		flushInterval?: number
	}

	export class PostHog {
		constructor(apiKey: string, options?: PostHogOptions)
		capture(options: CaptureOptions): Promise<void>
		shutdownAsync(): Promise<void>
		register(properties: Record<string, unknown>): void
	}
}

declare module "@posthog/ai" {
	type TracingOptions = {
		posthogDistinctId?: string
		posthogTraceId?: string
		posthogProperties?: Record<string, unknown>
		posthogGroups?: Record<string, unknown>
		posthogPrivacyMode?: boolean
	}

	export function withTracing<Model extends (...args: any[]) => any>(
		model: Model,
		client: unknown,
		options?: TracingOptions,
	): Model
}
