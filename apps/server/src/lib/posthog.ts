import { PostHog } from "posthog-node";
import { withTracing } from "@posthog/ai";

let client: PostHog | null = null;

const APP_VERSION =
	process.env.SERVER_APP_VERSION ??
	process.env.APP_VERSION ??
	process.env.NEXT_PUBLIC_APP_VERSION ??
	process.env.VERCEL_GIT_COMMIT_SHA ??
	"dev";

const DEPLOYMENT =
	process.env.SERVER_DEPLOYMENT ??
	process.env.DEPLOYMENT ??
	process.env.POSTHOG_DEPLOYMENT ??
	process.env.VERCEL_ENV ??
	(process.env.NODE_ENV === "production" ? "prod" : "local");

const ENVIRONMENT = process.env.POSTHOG_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
const DEPLOYMENT_REGION =
	process.env.POSTHOG_DEPLOYMENT_REGION ?? process.env.VERCEL_REGION ?? "local";

const BASE_SUPER_PROPERTIES = Object.freeze({
	app: "openchat-server",
	app_version: APP_VERSION,
	deployment: DEPLOYMENT,
	environment: ENVIRONMENT,
	deployment_region: DEPLOYMENT_REGION,
});

const POSTHOG_FLUSH_AT_RAW = Number(process.env.POSTHOG_FLUSH_AT ?? 10);
const POSTHOG_FLUSH_AT =
	Number.isFinite(POSTHOG_FLUSH_AT_RAW) && POSTHOG_FLUSH_AT_RAW > 1 ? POSTHOG_FLUSH_AT_RAW : 10;

function buildClient() {
	const apiKey = process.env.POSTHOG_API_KEY;
	if (!apiKey) return null;
	if (client) return client;
	const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
	client = new PostHog(apiKey, {
		host,
		flushAt: POSTHOG_FLUSH_AT,
		flushInterval: 5_000,
	});
	client.register(BASE_SUPER_PROPERTIES);
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
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (value === undefined) continue;
		sanitized[key] = value;
	}
	instance
		.capture({
			distinctId,
			event,
			properties: sanitized,
		})
		.catch((error: unknown) => {
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
