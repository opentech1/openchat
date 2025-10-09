import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

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
				client.register({ app: "openchat-web" });
			},
		});
		initialized = true;
	}
	return posthog;
}

export function captureClientEvent(event: string, properties?: Record<string, unknown>) {
	const client = initPosthog();
	if (!client) return;
	client.capture(event, properties);
}

export function identifyClient(distinctId: string | null | undefined) {
	const client = initPosthog();
	if (!client || !distinctId) return;
	client.identify(distinctId);
}

export function resetClient() {
	if (!initialized) return;
	posthog.reset();
}
