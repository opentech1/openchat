import { PostHog } from "posthog-node";
import { logError } from "./logger-server";

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

/**
 * PII (Personally Identifiable Information) field names that should be anonymized
 * Add any field names that might contain sensitive personal data
 */
const PII_FIELD_PATTERNS = [
	// Exact matches (case-insensitive)
	/^email$/i,
	/^phone$/i,
	/^phoneNumber$/i,
	/^address$/i,
	/^ipAddress$/i,
	/^ip$/i,
	/^name$/i,
	/^firstName$/i,
	/^lastName$/i,
	/^fullName$/i,
	/^ssn$/i,
	/^creditCard$/i,
	/^password$/i,
	/^token$/i,
	/^apiKey$/i,
	/^secret$/i,
	// Pattern matches
	/.*email.*/i,
	/.*phone.*/i,
	/.*address.*/i,
	/.*password.*/i,
	/.*secret.*/i,
	/.*token.*/i,
	/.*key.*/i,
	/.*ssn.*/i,
	/.*credit.*/i,
];

/**
 * Check if a field name contains PII
 */
function isPIIField(fieldName: string): boolean {
	return PII_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}

/**
 * Anonymize PII in event properties
 * - Removes fields that might contain PII
 * - Logs warning when PII fields are detected
 * - Preserves all non-PII data
 */
function anonymizePII(
	properties: Record<string, unknown>,
): Record<string, unknown> {
	const anonymized: Record<string, unknown> = {};
	const removedFields: string[] = [];

	for (const [key, value] of Object.entries(properties)) {
		if (isPIIField(key)) {
			// Remove PII field
			removedFields.push(key);
			continue;
		}

		// Recursively anonymize nested objects
		if (value && typeof value === "object" && !Array.isArray(value)) {
			anonymized[key] = anonymizePII(value as Record<string, unknown>);
		} else {
			// Keep non-PII values as-is
			anonymized[key] = value;
		}
	}

	// Log warning if PII was detected and removed
	if (removedFields.length > 0) {
		logWarn(
			`PII fields removed from PostHog event: ${removedFields.join(", ")}`,
		);
	}

	return anonymized;
}

export function captureServerEvent(
	event: string,
	distinctId: string | null | undefined,
	properties?: Record<string, unknown>,
) {
	const client = ensureServerClient();
	if (!client || !distinctId) return;

	// Start with base properties
	const sanitized: Record<string, unknown> = { ...BASE_SUPER_PROPERTIES };

	// Add and anonymize user properties
	if (properties) {
		// SECURITY: Anonymize PII before sending to PostHog
		const anonymized = anonymizePII(properties);
		for (const [key, value] of Object.entries(anonymized)) {
			if (value === undefined) continue;
			sanitized[key] = value;
		}
	}

	client
		.capture({ event, distinctId, properties: sanitized })
		.catch((error) => {
			logError("PostHog capture failed", error);
		});
}

export async function shutdownServerPosthog() {
	if (!serverClient) return;
	try {
		await serverClient.shutdownAsync();
	} catch (error) {
		logError("PostHog shutdown failed", error);
	}
	serverClient = null;
}
