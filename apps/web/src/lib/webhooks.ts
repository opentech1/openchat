/**
 * Webhook Signature Validation
 *
 * Validates webhook signatures to prevent webhook spoofing attacks.
 *
 * SECURITY: Without signature validation, anyone can send fake webhook requests
 * to your endpoints, potentially triggering unwanted actions or injecting false data.
 *
 * This module provides HMAC-SHA256 signature verification compatible with:
 * - GitHub Webhooks
 * - Stripe Webhooks
 * - PostHog Webhooks
 * - Sentry Webhooks
 * - Generic HMAC-signed webhooks
 */

import { createHmac, timingSafeEqual } from "crypto";
import { logError, logWarn } from "./logger-server";

/**
 * Webhook signature validation result
 */
export type WebhookValidation = {
	/** Whether the signature is valid */
	valid: boolean;
	/** Reason for validation failure */
	reason?: string;
	/** Timestamp from webhook (if present) */
	timestamp?: number;
};

/**
 * Generic HMAC-SHA256 signature validation
 *
 * @param payload - Raw webhook payload (string or Buffer)
 * @param signature - Signature from webhook header
 * @param secret - Webhook signing secret
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const isValid = validateHmacSignature(
 *   requestBody,
 *   request.headers.get("x-webhook-signature"),
 *   process.env.WEBHOOK_SECRET
 * );
 * ```
 */
export function validateHmacSignature(
	payload: string | Buffer,
	signature: string | null,
	secret: string,
): WebhookValidation {
	if (!signature) {
		return {
			valid: false,
			reason: "Missing signature header",
		};
	}

	if (!secret) {
		logError("Webhook secret not configured");
		return {
			valid: false,
			reason: "Server configuration error",
		};
	}

	try {
		// Compute expected signature
		const hmac = createHmac("sha256", secret);
		hmac.update(payload);
		const expectedSignature = hmac.digest("hex");

		// Remove any prefix (e.g., "sha256=")
		const cleanSignature = signature.replace(/^sha256=/i, "");

		// Timing-safe comparison to prevent timing attacks
		const signatureBuffer = Buffer.from(cleanSignature, "hex");
		const expectedBuffer = Buffer.from(expectedSignature, "hex");

		if (signatureBuffer.length !== expectedBuffer.length) {
			return {
				valid: false,
				reason: "Signature length mismatch",
			};
		}

		const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

		if (!isValid) {
			return {
				valid: false,
				reason: "Signature mismatch",
			};
		}

		return { valid: true };
	} catch (error) {
		logError("Error validating webhook signature", error);
		return {
			valid: false,
			reason: "Signature validation error",
		};
	}
}

/**
 * Validate GitHub webhook signature
 *
 * GitHub sends webhooks with X-Hub-Signature-256 header containing
 * an HMAC-SHA256 signature of the payload.
 *
 * @param payload - Raw webhook payload
 * @param signature - Value from X-Hub-Signature-256 header
 * @param secret - GitHub webhook secret
 * @returns Validation result
 *
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   const payload = await request.text();
 *   const signature = request.headers.get("x-hub-signature-256");
 *
 *   const validation = validateGitHubWebhook(
 *     payload,
 *     signature,
 *     process.env.GITHUB_WEBHOOK_SECRET!
 *   );
 *
 *   if (!validation.valid) {
 *     return new Response("Unauthorized", { status: 401 });
 *   }
 *
 *   // Process webhook...
 * }
 * ```
 */
export function validateGitHubWebhook(
	payload: string | Buffer,
	signature: string | null,
	secret: string,
): WebhookValidation {
	return validateHmacSignature(payload, signature, secret);
}

/**
 * Validate Stripe webhook signature
 *
 * Stripe uses a more complex signature scheme with timestamp to prevent
 * replay attacks. The signature format is: t=timestamp,v1=signature
 *
 * @param payload - Raw webhook payload
 * @param signature - Value from Stripe-Signature header
 * @param secret - Stripe webhook endpoint secret
 * @param toleranceSeconds - Maximum age of webhook (default: 300s = 5 minutes)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const validation = validateStripeWebhook(
 *   await request.text(),
 *   request.headers.get("stripe-signature"),
 *   process.env.STRIPE_WEBHOOK_SECRET!
 * );
 * ```
 */
export function validateStripeWebhook(
	payload: string | Buffer,
	signature: string | null,
	secret: string,
	toleranceSeconds = 300,
): WebhookValidation {
	if (!signature) {
		return {
			valid: false,
			reason: "Missing Stripe signature header",
		};
	}

	try {
		// Parse Stripe signature format: t=timestamp,v1=signature
		const parts = signature.split(",");
		const timestampPart = parts.find((p) => p.startsWith("t="));
		const signaturePart = parts.find((p) => p.startsWith("v1="));

		if (!timestampPart || !signaturePart) {
			return {
				valid: false,
				reason: "Invalid Stripe signature format",
			};
		}

		const timestamp = Number.parseInt(timestampPart.replace("t=", ""), 10);
		const sig = signaturePart.replace("v1=", "");

		// Check timestamp to prevent replay attacks
		const currentTime = Math.floor(Date.now() / 1000);
		if (currentTime - timestamp > toleranceSeconds) {
			return {
				valid: false,
				reason: "Webhook timestamp too old (possible replay attack)",
				timestamp,
			};
		}

		// Construct signed payload: timestamp.payload
		const signedPayload = `${timestamp}.${payload}`;

		// Validate signature
		const hmac = createHmac("sha256", secret);
		hmac.update(signedPayload);
		const expectedSignature = hmac.digest("hex");

		const signatureBuffer = Buffer.from(sig, "hex");
		const expectedBuffer = Buffer.from(expectedSignature, "hex");

		if (signatureBuffer.length !== expectedBuffer.length) {
			return {
				valid: false,
				reason: "Signature length mismatch",
				timestamp,
			};
		}

		const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

		if (!isValid) {
			return {
				valid: false,
				reason: "Signature mismatch",
				timestamp,
			};
		}

		return { valid: true, timestamp };
	} catch (error) {
		logError("Error validating Stripe webhook", error);
		return {
			valid: false,
			reason: "Signature validation error",
		};
	}
}

/**
 * Validate PostHog webhook signature
 *
 * PostHog sends webhooks with X-PostHog-Signature header.
 * The signature is computed as: sha256(payload + secret)
 *
 * @param payload - Raw webhook payload
 * @param signature - Value from X-PostHog-Signature header
 * @param secret - PostHog webhook secret
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const validation = validatePostHogWebhook(
 *   await request.text(),
 *   request.headers.get("x-posthog-signature"),
 *   process.env.POSTHOG_WEBHOOK_SECRET!
 * );
 * ```
 */
export function validatePostHogWebhook(
	payload: string | Buffer,
	signature: string | null,
	secret: string,
): WebhookValidation {
	if (!signature) {
		return {
			valid: false,
			reason: "Missing PostHog signature header",
		};
	}

	if (!secret) {
		logError("PostHog webhook secret not configured");
		return {
			valid: false,
			reason: "Server configuration error",
		};
	}

	try {
		// PostHog concatenates payload + secret then hashes
		const hmac = createHmac("sha256", "");
		hmac.update(payload);
		hmac.update(secret);
		const expectedSignature = hmac.digest("hex");

		// Timing-safe comparison
		const signatureBuffer = Buffer.from(signature, "hex");
		const expectedBuffer = Buffer.from(expectedSignature, "hex");

		if (signatureBuffer.length !== expectedBuffer.length) {
			return {
				valid: false,
				reason: "Signature length mismatch",
			};
		}

		const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

		if (!isValid) {
			return {
				valid: false,
				reason: "Signature mismatch",
			};
		}

		return { valid: true };
	} catch (error) {
		logError("Error validating PostHog webhook", error);
		return {
			valid: false,
			reason: "Signature validation error",
		};
	}
}

/**
 * Validate Sentry webhook signature
 *
 * Sentry sends webhooks with Sentry-Hook-Signature header.
 * The signature is computed as: HMAC-SHA256(secret, payload)
 *
 * @param payload - Raw webhook payload
 * @param signature - Value from Sentry-Hook-Signature header
 * @param secret - Sentry webhook client secret
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const validation = validateSentryWebhook(
 *   await request.text(),
 *   request.headers.get("sentry-hook-signature"),
 *   process.env.SENTRY_WEBHOOK_SECRET!
 * );
 * ```
 */
export function validateSentryWebhook(
	payload: string | Buffer,
	signature: string | null,
	secret: string,
): WebhookValidation {
	return validateHmacSignature(payload, signature, secret);
}

/**
 * Middleware wrapper for webhook signature validation
 *
 * @param request - The incoming request
 * @param secret - Webhook signing secret
 * @param signatureHeader - Name of the signature header (default: "x-webhook-signature")
 * @param handler - The actual webhook handler to call if validation passes
 * @returns Response from handler or 401 error
 *
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   return withWebhookValidation(
 *     request,
 *     process.env.WEBHOOK_SECRET!,
 *     "x-webhook-signature",
 *     async (payload) => {
 *       // Your webhook handler logic here
 *       const data = JSON.parse(payload);
 *       // Process webhook...
 *       return new Response("OK", { status: 200 });
 *     }
 *   );
 * }
 * ```
 */
export async function withWebhookValidation(
	request: Request,
	secret: string,
	signatureHeader = "x-webhook-signature",
	handler: (payload: string) => Promise<Response>,
): Promise<Response> {
	// Get raw payload (don't parse JSON yet - signature is computed on raw body)
	const payload = await request.text();
	const signature = request.headers.get(signatureHeader);

	const validation = validateHmacSignature(payload, signature, secret);

	if (!validation.valid) {
		logWarn("Webhook signature validation failed", {
			reason: validation.reason,
			header: signatureHeader,
		});

		return new Response(
			JSON.stringify({
				error: "Unauthorized",
				message: "Invalid webhook signature",
			}),
			{
				status: 401,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}

	// Call the actual handler with the payload
	return handler(payload);
}
