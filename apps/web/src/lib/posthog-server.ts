import { PostHog } from "posthog-node";

let serverClient: PostHog | null = null;

const APP_VERSION =
	process.env.APP_VERSION ??
	process.env.NEXT_PUBLIC_APP_VERSION ??
	process.env.VERCEL_GIT_COMMIT_SHA ??
	"dev";

const DEPLOYMENT =
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

export function captureServerEvent(
	event: string,
	distinctId: string | null | undefined,
	properties?: Record<string, unknown>,
) {
	const client = ensureServerClient();
	if (!client || !distinctId) return;
	const sanitized: Record<string, unknown> = { ...BASE_SUPER_PROPERTIES };
	if (properties) {
		for (const [key, value] of Object.entries(properties)) {
			if (value === undefined) continue;
			sanitized[key] = value;
		}
	}
	client
		.capture({ event, distinctId, properties: sanitized })
		.catch((error) => {
			console.error("[posthog] capture failed", error);
		});
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
