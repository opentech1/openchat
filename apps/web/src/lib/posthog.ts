import posthog from "posthog-js";

type IdentifyOptions = {
	workspaceId?: string | null | undefined;
	properties?: Record<string, unknown>;
};

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
const DEPLOYMENT =
	process.env.NEXT_PUBLIC_DEPLOYMENT ?? (process.env.NODE_ENV === "production" ? "prod" : "local");
const ELECTRIC_ENABLED = Boolean(process.env.NEXT_PUBLIC_ELECTRIC_URL);

const BASE_SUPER_PROPERTIES = Object.freeze({
	app: "openchat-web",
	app_version: APP_VERSION,
	deployment: DEPLOYMENT,
	electric_enabled: ELECTRIC_ENABLED,
});

let initialized = false;

export function initPosthog() {
	if (typeof window === "undefined") return null;
	if (!POSTHOG_KEY) return null;
	if (!initialized) {
		posthog.init(POSTHOG_KEY, {
			api_host: POSTHOG_HOST,
			capture_pageview: false,
			capture_pageleave: true,
			session_recording: {
				maskAllTextInputs: true,
				maskAllInputs: true,
				maskAllText: false,
				blockSelector: "[data-ph-no-capture]",
			} as any,
			loaded: (client) => {
				client.register(BASE_SUPER_PROPERTIES);
			},
		});
		initialized = true;
	}
	return posthog;
}

export function captureClientEvent(event: string, properties?: Record<string, unknown>) {
	const client = initPosthog();
	if (!client) return;
	if (!properties || Object.keys(properties).length === 0) {
		client.capture(event);
		return;
	}
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (value === undefined) continue;
		sanitized[key] = value;
	}
	client.capture(event, sanitized);
}

export function registerClientProperties(properties: Record<string, unknown>) {
	const client = initPosthog();
	if (!client) return;
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (value === undefined) continue;
		sanitized[key] = value;
	}
	if (Object.keys(sanitized).length === 0) return;
	client.register(sanitized);
}

export function identifyClient(distinctId: string | null | undefined, options?: IdentifyOptions) {
	const client = initPosthog();
	if (!client || !distinctId) return;
	client.identify(distinctId, options?.properties);
	const workspaceId = options?.workspaceId;
	if (workspaceId) {
		client.group("workspace", workspaceId);
		registerClientProperties({ workspace_id: workspaceId });
	}
}

export function resetClient() {
	if (!initialized) return;
	posthog.reset();
}
