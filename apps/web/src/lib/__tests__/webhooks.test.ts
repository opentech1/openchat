/**
 * Unit Tests for Webhook Validation
 *
 * Tests webhook signature validation.
 */

import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";

// Mock webhook validation functions
function generateWebhookSignature(
	payload: string,
	secret: string,
): string {
	return createHmac("sha256", secret).update(payload).digest("hex");
}

function validateWebhookSignature(
	payload: string,
	signature: string,
	secret: string,
): boolean {
	const expectedSignature = generateWebhookSignature(payload, secret);
	return signature === expectedSignature;
}

describe("generateWebhookSignature", () => {
	it("should generate HMAC signature", () => {
		// Arrange
		const payload = '{"event":"test"}';
		const secret = "webhook_secret";

		// Act
		const signature = generateWebhookSignature(payload, secret);

		// Assert
		expect(signature).toBeTruthy();
		expect(signature.length).toBe(64); // SHA256 hex = 64 chars
		expect(signature).toMatch(/^[0-9a-f]+$/);
	});

	it("should generate consistent signatures", () => {
		// Arrange
		const payload = '{"event":"test"}';
		const secret = "webhook_secret";

		// Act
		const sig1 = generateWebhookSignature(payload, secret);
		const sig2 = generateWebhookSignature(payload, secret);

		// Assert
		expect(sig1).toBe(sig2);
	});

	it("should generate different signatures for different payloads", () => {
		// Arrange
		const secret = "webhook_secret";

		// Act
		const sig1 = generateWebhookSignature('{"event":"a"}', secret);
		const sig2 = generateWebhookSignature('{"event":"b"}', secret);

		// Assert
		expect(sig1).not.toBe(sig2);
	});

	it("should generate different signatures for different secrets", () => {
		// Arrange
		const payload = '{"event":"test"}';

		// Act
		const sig1 = generateWebhookSignature(payload, "secret1");
		const sig2 = generateWebhookSignature(payload, "secret2");

		// Assert
		expect(sig1).not.toBe(sig2);
	});
});

describe("validateWebhookSignature", () => {
	it("should validate correct signature", () => {
		// Arrange
		const payload = '{"event":"test"}';
		const secret = "webhook_secret";
		const signature = generateWebhookSignature(payload, secret);

		// Act
		const isValid = validateWebhookSignature(payload, signature, secret);

		// Assert
		expect(isValid).toBe(true);
	});

	it("should reject incorrect signature", () => {
		// Arrange
		const payload = '{"event":"test"}';
		const secret = "webhook_secret";
		const wrongSignature = "0".repeat(64);

		// Act
		const isValid = validateWebhookSignature(
			payload,
			wrongSignature,
			secret,
		);

		// Assert
		expect(isValid).toBe(false);
	});

	it("should reject tampered payload", () => {
		// Arrange
		const originalPayload = '{"event":"test"}';
		const tamperedPayload = '{"event":"hack"}';
		const secret = "webhook_secret";
		const signature = generateWebhookSignature(originalPayload, secret);

		// Act
		const isValid = validateWebhookSignature(
			tamperedPayload,
			signature,
			secret,
		);

		// Assert
		expect(isValid).toBe(false);
	});

	it("should reject wrong secret", () => {
		// Arrange
		const payload = '{"event":"test"}';
		const secret = "webhook_secret";
		const wrongSecret = "wrong_secret";
		const signature = generateWebhookSignature(payload, secret);

		// Act
		const isValid = validateWebhookSignature(
			payload,
			signature,
			wrongSecret,
		);

		// Assert
		expect(isValid).toBe(false);
	});
});
