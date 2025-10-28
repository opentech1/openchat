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
