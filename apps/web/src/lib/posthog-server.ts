import { PostHog } from "posthog-node";
import { withTracing } from "@posthog/ai";

let serverClient: PostHog | null = null;

function ensureServerClient() {
	const apiKey = process.env.POSTHOG_API_KEY;
	if (!apiKey) return null;
	if (serverClient) return serverClient;
	const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
	serverClient = new PostHog(apiKey, {
		host,
		flushAt: 1,
		flushInterval: 5_000,
	});
	return serverClient;
}

export function captureServerEvent(event: string, distinctId: string | null | undefined, properties?: Record<string, unknown>) {
	const client = ensureServerClient();
	if (!client || !distinctId) return;
	client.capture({ event, distinctId, properties }).catch((error) => {
		console.error("[posthog] capture failed", error);
	});
}

export function withServerTracing<Model extends (...args: any[]) => any>(
	model: Model,
	options?: Parameters<typeof withTracing<Model>>[2],
) {
	const client = ensureServerClient();
	if (!client) return model;
	return withTracing(model, client, options ?? {});
}

export async function shutdownServerPosthog() {
	if (!serverClient) return;
	try {
		await serverClient.shutdownAsync();
	} catch (error) {
		console.error("[posthog] shutdown failed", error);
	}
	serverClient = null;
}
