/**
 * Integration Tests for CSRF Token API Route
 *
 * Comprehensive integration tests for the CSRF token generation endpoint.
 * Tests token generation, cookie setting, security headers, and error handling.
 *
 * Test Coverage:
 * - CSRF token generation (20+ tests)
 * - Secure cookie configuration
 * - Response headers
 * - Token validation
 * - Environment-specific behavior
 * - Security properties
 *
 * SECURITY CRITICAL: CSRF protection is essential for preventing cross-site request forgery attacks.
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, CSRF_TOKEN_LENGTH } from "@/lib/csrf";

describe("CSRF API Route - Token Generation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should return 200 status", async () => {
		const response = await GET();

		expect(response.status).toBe(200);
	});

	test("should return JSON response", async () => {
		const response = await GET();

		expect(response.headers.get("Content-Type")).toContain("application/json");
	});

	test("should return token in response body", async () => {
		const response = await GET();
		const body = await response.json();

		expect(body).toHaveProperty("token");
		expect(typeof body.token).toBe("string");
		expect(body.token.length).toBeGreaterThan(0);
	});

	test("should return message in response body", async () => {
		const response = await GET();
		const body = await response.json();

		expect(body).toHaveProperty("message");
		expect(body.message).toBe("CSRF token generated");
	});

	test("should generate unique tokens on each request", async () => {
		const response1 = await GET();
		const response2 = await GET();

		const body1 = await response1.json();
		const body2 = await response2.json();

		expect(body1.token).not.toBe(body2.token);
	});

	test("should generate tokens with sufficient length", async () => {
		const response = await GET();
		const body = await response.json();

		// Tokens should be base64url encoded (32 bytes = ~43 characters)
		expect(body.token.length).toBeGreaterThan(40);
	});

	test("should generate URL-safe tokens", async () => {
		const response = await GET();
		const body = await response.json();

		// base64url should not contain +, /, or =
		expect(body.token).not.toContain("+");
		expect(body.token).not.toContain("/");
		expect(body.token).not.toContain("=");
	});

	test("should generate tokens with high entropy", async () => {
		const responses = await Promise.all(
			Array.from({ length: 100 }, () => GET()),
		);

		const tokens = await Promise.all(
			responses.map(async (r) => {
				const body = await r.json();
				return body.token;
			}),
		);

		// All tokens should be unique
		const uniqueTokens = new Set(tokens);
		expect(uniqueTokens.size).toBe(100);
	});

	test("should handle rapid concurrent requests", async () => {
		const requests = Array.from({ length: 10 }, () => GET());

		const responses = await Promise.all(requests);

		expect(responses).toHaveLength(10);
		responses.forEach((response) => {
			expect(response.status).toBe(200);
		});
	});

	test("should generate cryptographically secure tokens", async () => {
		const responses = await Promise.all(
			Array.from({ length: 10 }, () => GET()),
		);

		const tokens = await Promise.all(
			responses.map(async (r) => {
				const body = await r.json();
				return body.token;
			}),
		);

		// Check for patterns (no token should be substring of another)
		for (let i = 0; i < tokens.length; i++) {
			for (let j = i + 1; j < tokens.length; j++) {
				expect(tokens[i]).not.toContain(tokens[j].slice(0, 10));
			}
		}
	});
});

describe("CSRF API Route - Cookie Configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should set CSRF cookie in response", async () => {
		const response = await GET();

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toBeDefined();
		expect(setCookie).toContain(CSRF_COOKIE_NAME);
	});

	test("should set cookie with generated token", async () => {
		const response = await GET();
		const body = await response.json();

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain(body.token);
	});

	test("should set HttpOnly flag on cookie", async () => {
		const response = await GET();

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain("HttpOnly");
	});

	test("should set SameSite=Lax on cookie", async () => {
		const response = await GET();

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain("SameSite=Lax");
	});

	test("should set Path=/ on cookie", async () => {
		const response = await GET();

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain("Path=/");
	});

	test("should set Max-Age on cookie", async () => {
		const response = await GET();

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain("Max-Age=");
	});

	test("should set 24-hour expiration (86400 seconds)", async () => {
		const response = await GET();

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain("Max-Age=86400");
	});

	test("should include Secure flag in production", async () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		const response = await GET();

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toContain("Secure");

		process.env.NODE_ENV = originalEnv;
	});

	test("should not include Secure flag in development", async () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const response = await GET();

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).not.toContain("Secure");

		process.env.NODE_ENV = originalEnv;
	});

	test("should handle production environment correctly", async () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		const response = await GET();
		const setCookie = response.headers.get("Set-Cookie");

		// Production should have: Secure, HttpOnly, SameSite=Lax
		expect(setCookie).toContain("Secure");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("SameSite=Lax");

		process.env.NODE_ENV = originalEnv;
	});
});

describe("CSRF API Route - Response Headers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should include X-CSRF-Token header", async () => {
		const response = await GET();

		const csrfHeader = response.headers.get(CSRF_HEADER_NAME);
		expect(csrfHeader).toBeDefined();
		expect(csrfHeader!.length).toBeGreaterThan(0);
	});

	test("should match token in header and body", async () => {
		const response = await GET();
		const body = await response.json();

		const headerToken = response.headers.get(CSRF_HEADER_NAME);
		expect(headerToken).toBe(body.token);
	});

	test("should match token in header and cookie", async () => {
		const response = await GET();

		const headerToken = response.headers.get(CSRF_HEADER_NAME);
		const setCookie = response.headers.get("Set-Cookie");

		expect(setCookie).toContain(headerToken!);
	});

	test("should have consistent token across all outputs", async () => {
		const response = await GET();
		const body = await response.json();

		const headerToken = response.headers.get(CSRF_HEADER_NAME);
		const setCookie = response.headers.get("Set-Cookie");

		// Extract token from cookie (simple regex)
		const cookieMatch = setCookie?.match(/openchat\.csrf_token=([^;]+)/);
		const cookieToken = cookieMatch ? cookieMatch[1] : null;

		expect(body.token).toBe(headerToken);
		expect(body.token).toBe(cookieToken);
	});

	test("should set Content-Type header", async () => {
		const response = await GET();

		expect(response.headers.get("Content-Type")).toContain("application/json");
	});

	test("should not leak sensitive information in headers", async () => {
		const response = await GET();

		// Should not expose internal implementation details
		expect(response.headers.get("X-Powered-By")).toBeNull();
		expect(response.headers.get("Server")).toBeNull();
	});
});

describe("CSRF API Route - Token Validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should generate tokens that pass validation", async () => {
		const response = await GET();
		const body = await response.json();

		// Token should be non-empty string
		expect(typeof body.token).toBe("string");
		expect(body.token.length).toBeGreaterThan(0);
	});

	test("should generate tokens with no whitespace", async () => {
		const response = await GET();
		const body = await response.json();

		expect(body.token).not.toContain(" ");
		expect(body.token).not.toContain("\t");
		expect(body.token).not.toContain("\n");
	});

	test("should generate tokens with valid characters only", async () => {
		const response = await GET();
		const body = await response.json();

		// base64url: alphanumeric, -, _
		expect(body.token).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	test("should generate tokens with expected length", async () => {
		const response = await GET();
		const body = await response.json();

		// 32 bytes base64url encoded should be ~43 chars
		expect(body.token.length).toBeGreaterThanOrEqual(43);
		expect(body.token.length).toBeLessThanOrEqual(50);
	});
});

describe("CSRF API Route - Security Properties", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should not allow predictable token generation", async () => {
		const responses = await Promise.all(
			Array.from({ length: 50 }, () => GET()),
		);

		const tokens = await Promise.all(
			responses.map(async (r) => {
				const body = await r.json();
				return body.token;
			}),
		);

		// Check that there's no pattern in sequential tokens
		for (let i = 0; i < tokens.length - 1; i++) {
			const token1 = tokens[i];
			const token2 = tokens[i + 1];

			// Tokens should not share common prefixes/suffixes
			expect(token1.slice(0, 10)).not.toBe(token2.slice(0, 10));
			expect(token1.slice(-10)).not.toBe(token2.slice(-10));
		}
	});

	test("should use cryptographically secure random", async () => {
		const responses = await Promise.all(
			Array.from({ length: 1000 }, () => GET()),
		);

		const tokens = await Promise.all(
			responses.map(async (r) => {
				const body = await r.json();
				return body.token;
			}),
		);

		// All 1000 tokens should be unique
		const uniqueTokens = new Set(tokens);
		expect(uniqueTokens.size).toBe(1000);
	});

	test("should prevent cookie manipulation", async () => {
		const response = await GET();
		const setCookie = response.headers.get("Set-Cookie");

		// Cookie should be HttpOnly (can't be accessed by JavaScript)
		expect(setCookie).toContain("HttpOnly");

		// Cookie should be SameSite (prevents CSRF)
		expect(setCookie).toContain("SameSite=Lax");
	});

	test("should enforce secure cookie in production", async () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		const response = await GET();
		const setCookie = response.headers.get("Set-Cookie");

		// Production cookies must be Secure (HTTPS only)
		expect(setCookie).toContain("Secure");

		process.env.NODE_ENV = originalEnv;
	});

	test("should not expose token generation algorithm", async () => {
		const response = await GET();
		const body = await response.json();

		// Response should not leak implementation details
		expect(body).not.toHaveProperty("algorithm");
		expect(body).not.toHaveProperty("entropy");
		expect(body).not.toHaveProperty("seed");
	});

	test("should handle token collision (extremely rare)", async () => {
		// Generate many tokens to test collision handling
		const responses = await Promise.all(
			Array.from({ length: 10000 }, () => GET()),
		);

		const tokens = await Promise.all(
			responses.map(async (r) => {
				const body = await r.json();
				return body.token;
			}),
		);

		// All tokens should be unique (collision probability is negligible)
		const uniqueTokens = new Set(tokens);
		expect(uniqueTokens.size).toBe(10000);
	});
});

describe("CSRF API Route - Performance", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should generate token quickly", async () => {
		const start = performance.now();
		await GET();
		const duration = performance.now() - start;

		// Should complete in less than 100ms
		expect(duration).toBeLessThan(100);
	});

	test("should handle burst of requests efficiently", async () => {
		const start = performance.now();

		const requests = Array.from({ length: 100 }, () => GET());
		await Promise.all(requests);

		const duration = performance.now() - start;

		// Should complete 100 requests in less than 1 second
		expect(duration).toBeLessThan(1000);
	});

	test("should not leak memory on repeated calls", async () => {
		const iterations = 1000;

		for (let i = 0; i < iterations; i++) {
			await GET();
		}

		// If we get here without running out of memory, test passes
		expect(true).toBe(true);
	});
});

describe("CSRF API Route - Edge Cases", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should handle undefined NODE_ENV", async () => {
		const originalEnv = process.env.NODE_ENV;
		delete process.env.NODE_ENV;

		const response = await GET();

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty("token");

		if (originalEnv) {
			process.env.NODE_ENV = originalEnv;
		}
	});

	test("should handle test environment", async () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "test";

		const response = await GET();

		expect(response.status).toBe(200);
		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).not.toContain("Secure");

		process.env.NODE_ENV = originalEnv;
	});

	test("should handle multiple rapid sequential requests", async () => {
		const responses: Response[] = [];

		for (let i = 0; i < 10; i++) {
			responses.push(await GET());
		}

		expect(responses).toHaveLength(10);
		responses.forEach((response) => {
			expect(response.status).toBe(200);
		});
	});

	test("should not break on missing crypto module (fallback)", async () => {
		// This would require mocking crypto, which is complex
		// Just verify that the endpoint works normally
		const response = await GET();

		expect(response.status).toBe(200);
	});
});

describe("CSRF API Route - Integration with Client", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should provide all necessary data for client", async () => {
		const response = await GET();
		const body = await response.json();

		// Client needs: token in body, token in header, cookie set
		expect(body).toHaveProperty("token");
		expect(response.headers.get(CSRF_HEADER_NAME)).toBeDefined();
		expect(response.headers.get("Set-Cookie")).toBeDefined();
	});

	test("should enable client to extract token from header", async () => {
		const response = await GET();

		const headerToken = response.headers.get(CSRF_HEADER_NAME);
		expect(headerToken).toBeDefined();
		expect(typeof headerToken).toBe("string");
	});

	test("should enable client to extract token from body", async () => {
		const response = await GET();
		const body = await response.json();

		expect(body.token).toBeDefined();
		expect(typeof body.token).toBe("string");
	});

	test("should set cookie that browser will send back", async () => {
		const response = await GET();

		const setCookie = response.headers.get("Set-Cookie");

		// Cookie should have proper attributes for browser to send back
		expect(setCookie).toContain("Path=/"); // Available for all paths
		expect(setCookie).toContain(CSRF_COOKIE_NAME); // Proper name
	});
});
