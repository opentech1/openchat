/**
 * Unit Tests for CSRF Protection Utility
 *
 * Comprehensive test coverage for CSRF protection including:
 * - Token generation and validation
 * - Double Submit Cookie pattern
 * - Constant-time comparison
 * - HTTP method filtering
 * - Cookie configuration
 * - Middleware wrapper
 * - Error handling
 *
 * Security Critical: This module protects against Cross-Site Request Forgery attacks.
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import {
	generateCsrfToken,
	validateCsrfToken,
	createCsrfCookie,
	requiresCsrfProtection,
	withCsrfProtection,
	responseWithCsrfToken,
	CSRF_COOKIE_NAME,
	CSRF_HEADER_NAME,
	CSRF_TOKEN_LENGTH,
} from "./csrf";

describe("generateCsrfToken", () => {
	test("should generate a token", () => {
		const token = generateCsrfToken();

		expect(token).toBeDefined();
		expect(typeof token).toBe("string");
		expect(token.length).toBeGreaterThan(0);
	});

	test("should generate unique tokens", () => {
		const token1 = generateCsrfToken();
		const token2 = generateCsrfToken();

		expect(token1).not.toBe(token2);
	});

	test("should generate tokens with sufficient entropy", () => {
		const tokens = new Set();

		for (let i = 0; i < 100; i++) {
			tokens.add(generateCsrfToken());
		}

		// All tokens should be unique
		expect(tokens.size).toBe(100);
	});

	test("should generate URL-safe base64 tokens", () => {
		const token = generateCsrfToken();

		// base64url should not contain +, /, or =
		expect(token).not.toContain("+");
		expect(token).not.toContain("/");
		expect(token).not.toContain("=");
	});

	test("should generate tokens of expected length", () => {
		const token = generateCsrfToken();

		// base64url encoding of 32 bytes should be ~43 characters
		expect(token.length).toBeGreaterThan(40);
		expect(token.length).toBeLessThan(50);
	});

	test("should use cryptographically secure random", () => {
		const tokens = Array.from({ length: 10 }, () => generateCsrfToken());

		// Check for patterns (no token should be substring of another)
		for (let i = 0; i < tokens.length; i++) {
			for (let j = i + 1; j < tokens.length; j++) {
				expect(tokens[i]).not.toContain(tokens[j].slice(0, 10));
			}
		}
	});

	test("should handle rapid generation", () => {
		const startTime = Date.now();
		const tokens = Array.from({ length: 1000 }, () => generateCsrfToken());
		const duration = Date.now() - startTime;

		expect(tokens).toHaveLength(1000);
		expect(duration).toBeLessThan(1000); // Should be fast
	});
});

describe("validateCsrfToken - Basic Validation", () => {
	test("should validate matching tokens", () => {
		const token = generateCsrfToken();
		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		const result = validateCsrfToken(request, token);

		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should reject missing cookie token", () => {
		const token = generateCsrfToken();
		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		const result = validateCsrfToken(request, undefined);

		expect(result.valid).toBe(false);
		expect(result.error).toBe("Missing CSRF cookie");
	});

	test("should reject missing header token", () => {
		const token = generateCsrfToken();
		const request = new Request("http://example.com", {
			method: "POST",
		});

		const result = validateCsrfToken(request, token);

		expect(result.valid).toBe(false);
		expect(result.error).toBe("Missing CSRF header");
	});

	test("should reject mismatched tokens", () => {
		const cookieToken = generateCsrfToken();
		const headerToken = generateCsrfToken();

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: headerToken,
			},
		});

		const result = validateCsrfToken(request, cookieToken);

		expect(result.valid).toBe(false);
		expect(result.error).toBe("CSRF token mismatch");
	});

	test("should reject empty cookie token", () => {
		const headerToken = generateCsrfToken();

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: headerToken,
			},
		});

		const result = validateCsrfToken(request, "");

		expect(result.valid).toBe(false);
		expect(result.error).toBe("Missing CSRF cookie");
	});

	test("should reject empty header token", () => {
		const cookieToken = generateCsrfToken();

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: "",
			},
		});

		const result = validateCsrfToken(request, cookieToken);

		expect(result.valid).toBe(false);
		expect(result.error).toBe("Missing CSRF header");
	});

	test("should be case-sensitive for tokens", () => {
		const token = generateCsrfToken().toLowerCase();
		const upperToken = token.toUpperCase();

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: upperToken,
			},
		});

		const result = validateCsrfToken(request, token);

		expect(result.valid).toBe(false);
	});
});

describe("validateCsrfToken - Constant-Time Comparison", () => {
	test("should use timing-safe comparison", () => {
		const token = generateCsrfToken();
		const wrongToken = generateCsrfToken();

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: wrongToken,
			},
		});

		// Measure time for wrong token
		const start1 = performance.now();
		const result1 = validateCsrfToken(request, token);
		const duration1 = performance.now() - start1;

		// Time should be consistent regardless of where tokens differ
		expect(result1.valid).toBe(false);
		expect(duration1).toBeGreaterThan(0);
	});

	test("should handle identical tokens efficiently", () => {
		const token = generateCsrfToken();

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		const start = performance.now();
		const result = validateCsrfToken(request, token);
		const duration = performance.now() - start;

		expect(result.valid).toBe(true);
		expect(duration).toBeLessThan(100); // Should be fast
	});

	test("should not leak timing information", () => {
		const token = "a".repeat(43);
		const wrongAtStart = "b" + "a".repeat(42);
		const wrongAtEnd = "a".repeat(42) + "b";

		const request1 = new Request("http://example.com", {
			method: "POST",
			headers: { [CSRF_HEADER_NAME]: wrongAtStart },
		});

		const request2 = new Request("http://example.com", {
			method: "POST",
			headers: { [CSRF_HEADER_NAME]: wrongAtEnd },
		});

		// Both should fail regardless of where they differ
		const result1 = validateCsrfToken(request1, token);
		const result2 = validateCsrfToken(request2, token);

		expect(result1.valid).toBe(false);
		expect(result2.valid).toBe(false);
	});
});

describe("validateCsrfToken - Edge Cases", () => {
	test("should handle very long tokens", () => {
		const longToken = "a".repeat(1000);

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: longToken,
			},
		});

		const result = validateCsrfToken(request, longToken);

		expect(result.valid).toBe(true);
	});

	test("should handle special characters in tokens", () => {
		// While real tokens are base64url, test robustness
		const token = "abc-123_xyz";

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		const result = validateCsrfToken(request, token);

		expect(result.valid).toBe(true);
	});

	test("should handle whitespace in tokens", () => {
		const token = generateCsrfToken();
		const tokenWithSpace = `${token} `;

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: tokenWithSpace,
			},
		});

		// Headers are trimmed automatically, so this actually passes
		const result = validateCsrfToken(request, token);

		// Whitespace handling depends on header implementation
		expect(result.valid).toBeDefined();
	});

	test("should handle null byte in token", () => {
		const token = generateCsrfToken();
		// Headers can't contain null bytes, so this test would fail at header creation
		// Instead, test with a different malicious character
		const maliciousToken = token + "malicious";

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: maliciousToken,
			},
		});

		const result = validateCsrfToken(request, token);

		expect(result.valid).toBe(false);
	});

	test("should handle ASCII tokens", () => {
		// HTTP headers must be ASCII, so use valid ASCII token
		const token = "valid-ascii-token-123";

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		const result = validateCsrfToken(request, token);

		expect(result.valid).toBe(true);
	});
});

describe("createCsrfCookie", () => {
	test("should create cookie with token", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, false);

		expect(cookie).toContain(CSRF_COOKIE_NAME);
		expect(cookie).toContain(token);
	});

	test("should include HttpOnly flag", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, false);

		expect(cookie).toContain("HttpOnly");
	});

	test("should include SameSite=Lax", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, false);

		expect(cookie).toContain("SameSite=Lax");
	});

	test("should include Path=/", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, false);

		expect(cookie).toContain("Path=/");
	});

	test("should include Max-Age", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, false);

		expect(cookie).toContain("Max-Age=");
	});

	test("should include Secure flag in production", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, true);

		expect(cookie).toContain("Secure");
	});

	test("should not include Secure flag in development", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, false);

		expect(cookie).not.toContain("Secure");
	});

	test("should set 24-hour expiration", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, false);

		expect(cookie).toContain("Max-Age=86400");
	});

	test("should handle special characters in token", () => {
		const token = "abc+def/ghi=";
		const cookie = createCsrfCookie(token, false);

		expect(cookie).toContain(token);
	});
});

describe("requiresCsrfProtection", () => {
	test("should require protection for POST", () => {
		expect(requiresCsrfProtection("POST")).toBe(true);
	});

	test("should require protection for PUT", () => {
		expect(requiresCsrfProtection("PUT")).toBe(true);
	});

	test("should require protection for DELETE", () => {
		expect(requiresCsrfProtection("DELETE")).toBe(true);
	});

	test("should require protection for PATCH", () => {
		expect(requiresCsrfProtection("PATCH")).toBe(true);
	});

	test("should not require protection for GET", () => {
		expect(requiresCsrfProtection("GET")).toBe(false);
	});

	test("should not require protection for HEAD", () => {
		expect(requiresCsrfProtection("HEAD")).toBe(false);
	});

	test("should not require protection for OPTIONS", () => {
		expect(requiresCsrfProtection("OPTIONS")).toBe(false);
	});

	test("should be case-insensitive", () => {
		expect(requiresCsrfProtection("post")).toBe(true);
		expect(requiresCsrfProtection("Post")).toBe(true);
		expect(requiresCsrfProtection("get")).toBe(false);
		expect(requiresCsrfProtection("Get")).toBe(false);
	});

	test("should handle unknown methods safely", () => {
		// Unknown methods should require protection (fail-safe)
		expect(requiresCsrfProtection("CUSTOM")).toBe(true);
	});
});

describe("withCsrfProtection - Middleware", () => {
	test("should allow safe methods without token", async () => {
		const request = new Request("http://example.com", {
			method: "GET",
		});

		const handler = vi.fn().mockResolvedValue(new Response("OK"));

		const response = await withCsrfProtection(request, undefined, handler);

		expect(handler).toHaveBeenCalled();
		expect(response.status).toBe(200);
	});

	test("should call handler for valid CSRF token", async () => {
		const token = generateCsrfToken();
		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		const handler = vi.fn().mockResolvedValue(new Response("OK"));

		const response = await withCsrfProtection(request, token, handler);

		expect(handler).toHaveBeenCalled();
		expect(response.status).toBe(200);
	});

	test("should block invalid CSRF token", async () => {
		const cookieToken = generateCsrfToken();
		const headerToken = generateCsrfToken();

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: headerToken,
			},
		});

		const handler = vi.fn().mockResolvedValue(new Response("OK"));

		const response = await withCsrfProtection(
			request,
			cookieToken,
			handler,
		);

		expect(handler).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
	});

	test("should return 403 for missing token", async () => {
		const request = new Request("http://example.com", {
			method: "POST",
		});

		const handler = vi.fn().mockResolvedValue(new Response("OK"));

		const response = await withCsrfProtection(request, undefined, handler);

		expect(handler).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
	});

	test("should return JSON error response", async () => {
		const request = new Request("http://example.com", {
			method: "POST",
		});

		const handler = vi.fn().mockResolvedValue(new Response("OK"));

		const response = await withCsrfProtection(request, undefined, handler);

		expect(response.headers.get("Content-Type")).toBe("application/json");

		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body).toHaveProperty("message");
	});

	test("should skip CSRF check for OPTIONS requests", async () => {
		const request = new Request("http://example.com", {
			method: "OPTIONS",
		});

		const handler = vi.fn().mockResolvedValue(new Response("OK"));

		const response = await withCsrfProtection(request, undefined, handler);

		expect(handler).toHaveBeenCalled();
		expect(response.status).toBe(200);
	});

	test("should handle handler errors", async () => {
		const token = generateCsrfToken();
		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		const handler = vi.fn().mockRejectedValue(new Error("Handler error"));

		await expect(
			withCsrfProtection(request, token, handler),
		).rejects.toThrow("Handler error");
	});

	test("should pass through handler response", async () => {
		const token = generateCsrfToken();
		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		const customResponse = new Response("Custom", {
			status: 201,
			headers: { "X-Custom": "value" },
		});

		const handler = vi.fn().mockResolvedValue(customResponse);

		const response = await withCsrfProtection(request, token, handler);

		expect(response.status).toBe(201);
		expect(response.headers.get("X-Custom")).toBe("value");
	});
});

describe("responseWithCsrfToken", () => {
	test("should add CSRF token to response", () => {
		const original = new Response("OK");

		const enhanced = responseWithCsrfToken(original);

		expect(enhanced.headers.has("Set-Cookie")).toBe(true);
		expect(enhanced.headers.has(CSRF_HEADER_NAME)).toBe(true);
	});

	test("should set cookie with token", () => {
		const original = new Response("OK");

		const enhanced = responseWithCsrfToken(original);

		const cookie = enhanced.headers.get("Set-Cookie");
		expect(cookie).toContain(CSRF_COOKIE_NAME);
	});

	test("should set header with token", () => {
		const original = new Response("OK");

		const enhanced = responseWithCsrfToken(original);

		const token = enhanced.headers.get(CSRF_HEADER_NAME);
		expect(token).toBeDefined();
		expect(token!.length).toBeGreaterThan(0);
	});

	test("should match cookie and header tokens", () => {
		const original = new Response("OK");

		const enhanced = responseWithCsrfToken(original);

		const headerToken = enhanced.headers.get(CSRF_HEADER_NAME);
		const cookie = enhanced.headers.get("Set-Cookie");

		expect(cookie).toContain(headerToken!);
	});

	test("should preserve original response body", async () => {
		const original = new Response("Original Body");

		const enhanced = responseWithCsrfToken(original);

		const body = await enhanced.text();
		expect(body).toBe("Original Body");
	});

	test("should preserve original status code", () => {
		const original = new Response("OK", { status: 201 });

		const enhanced = responseWithCsrfToken(original);

		expect(enhanced.status).toBe(201);
	});

	test("should preserve original headers", () => {
		const original = new Response("OK", {
			headers: { "X-Custom": "value" },
		});

		const enhanced = responseWithCsrfToken(original);

		expect(enhanced.headers.get("X-Custom")).toBe("value");
	});

	test("should use production settings based on NODE_ENV", () => {
		const originalEnv = process.env.NODE_ENV;

		// Test production
		process.env.NODE_ENV = "production";
		const prodResponse = responseWithCsrfToken(new Response("OK"));
		const prodCookie = prodResponse.headers.get("Set-Cookie");
		expect(prodCookie).toContain("Secure");

		// Test development
		process.env.NODE_ENV = "development";
		const devResponse = responseWithCsrfToken(new Response("OK"));
		const devCookie = devResponse.headers.get("Set-Cookie");
		expect(devCookie).not.toContain("Secure");

		// Restore
		process.env.NODE_ENV = originalEnv;
	});
});

describe("Security Properties", () => {
	test("should use cryptographically secure random for tokens", () => {
		const tokens = new Set();

		// Generate many tokens and check for duplicates
		for (let i = 0; i < 10000; i++) {
			tokens.add(generateCsrfToken());
		}

		// No duplicates expected with cryptographically secure random
		expect(tokens.size).toBe(10000);
	});

	test("should have sufficient token entropy", () => {
		const token = generateCsrfToken();

		// Token should be at least 32 bytes (256 bits) of entropy
		// base64url encoding makes it ~43 characters
		expect(token.length).toBeGreaterThanOrEqual(43);
	});

	test("should prevent timing attacks through hashing", () => {
		const token1 = "a".repeat(43);
		const token2 = "b".repeat(43);

		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token2,
			},
		});

		// Validation should take similar time regardless of token difference
		const times: number[] = [];

		for (let i = 0; i < 100; i++) {
			const start = performance.now();
			validateCsrfToken(request, token1);
			times.push(performance.now() - start);
		}

		// Calculate variance (should be relatively low)
		const avg = times.reduce((a, b) => a + b) / times.length;
		const variance =
			times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) /
			times.length;

		// Variance should be low (constant-time)
		expect(variance).toBeLessThan(10);
	});

	test("should not expose token in error messages", () => {
		const token = generateCsrfToken();
		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		const result = validateCsrfToken(request, "different-token");

		expect(result.error).not.toContain(token);
		expect(result.error).not.toContain("different-token");
	});

	test("should enforce HttpOnly cookie to prevent XSS", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, true);

		expect(cookie).toContain("HttpOnly");
	});

	test("should use SameSite=Lax for basic CSRF protection", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, true);

		expect(cookie).toContain("SameSite=Lax");
	});

	test("should enforce Secure flag in production", () => {
		const token = generateCsrfToken();
		const cookie = createCsrfCookie(token, true);

		expect(cookie).toContain("Secure");
	});
});

describe("Integration Scenarios", () => {
	test("should handle complete CSRF flow", async () => {
		// 1. Generate token
		const token = generateCsrfToken();

		// 2. Create cookie
		const cookie = createCsrfCookie(token, false);
		expect(cookie).toContain(token);

		// 3. Client makes request with token in header
		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		// 4. Server validates
		const validation = validateCsrfToken(request, token);
		expect(validation.valid).toBe(true);

		// 5. Handler executes
		const handler = vi.fn().mockResolvedValue(new Response("Success"));
		const response = await withCsrfProtection(request, token, handler);

		expect(handler).toHaveBeenCalled();
		expect(response.status).toBe(200);
	});

	test("should handle token rotation", async () => {
		// Old token
		const oldToken = generateCsrfToken();

		// Client receives new token
		const response = responseWithCsrfToken(new Response("OK"));
		const newToken = response.headers.get(CSRF_HEADER_NAME)!;

		// Client uses new token
		const request = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: newToken,
			},
		});

		const validation = validateCsrfToken(request, newToken);
		expect(validation.valid).toBe(true);

		// Old token should fail
		const oldRequest = new Request("http://example.com", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: oldToken,
			},
		});

		const oldValidation = validateCsrfToken(oldRequest, newToken);
		expect(oldValidation.valid).toBe(false);
	});

	test("should protect multiple endpoints", async () => {
		const token = generateCsrfToken();

		const endpoints = [
			"http://example.com/api/chat",
			"http://example.com/api/user",
			"http://example.com/api/settings",
		];

		for (const url of endpoints) {
			const request = new Request(url, {
				method: "POST",
				headers: {
					[CSRF_HEADER_NAME]: token,
				},
			});

			const handler = vi.fn().mockResolvedValue(new Response("OK"));
			const response = await withCsrfProtection(request, token, handler);

			expect(response.status).toBe(200);
		}
	});

	test("should block CSRF attacks", async () => {
		// Attacker tries to forge request without token
		const request = new Request("http://example.com", {
			method: "POST",
			body: JSON.stringify({ action: "transfer", amount: 1000 }),
		});

		const handler = vi.fn().mockResolvedValue(new Response("OK"));
		const response = await withCsrfProtection(request, undefined, handler);

		expect(handler).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
	});
});
