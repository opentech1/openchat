import { PostHog } from "posthog-node";
import { withTracing } from "@posthog/ai";

let client: PostHog | null = null;

function buildClient() {
	const apiKey = process.env.POSTHOG_API_KEY;
	if (!apiKey) return null;
	if (client) return client;
	const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
	client = new PostHog(apiKey, {
		host,
		flushAt: 1,
		flushInterval: 5_000,
	});
	return client;
}

export function getPostHog() {
	return buildClient();
}

export function capturePosthogEvent(
	event: string,
	distinctId: string | null | undefined,
	properties: Record<string, unknown> = {},
) {
	const instance = buildClient();
	if (!instance || !distinctId) return;
	instance.capture({
		distinctId,
		event,
		properties,
	}).catch((error: unknown) => {
		console.error("[posthog] capture failed", error);
	});
}

export function withPosthogTracing<Model extends (...args: any[]) => any>(
	model: Model,
	options: Parameters<typeof withTracing<Model>>[2] | undefined,
) {
	const instance = buildClient();
	if (!instance) return model;
	return withTracing(model, instance, options ?? {});
}

export async function shutdownPosthog() {
	if (!client) return;
	try {
		await client.shutdownAsync();
	} catch (error) {
		console.error("[posthog] shutdown failed", error);
	}
	client = null;
}
