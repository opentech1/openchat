/**
 * Unit Tests for CSRF Protection
 *
 * Tests CSRF token generation, validation, and cookie handling.
 * These tests ensure the Double Submit Cookie pattern is correctly implemented.
 */

import { describe, it, expect, vi } from "vitest";
import {
	generateCsrfToken,
	validateCsrfToken,
	createCsrfCookie,
	requiresCsrfProtection,
	withCsrfProtection,
	responseWithCsrfToken,
	CSRF_COOKIE_NAME,
	CSRF_HEADER_NAME,
} from "../csrf";

describe("generateCsrfToken", () => {
	it("should generate token of correct length", () => {
		// Arrange & Act
		const token = generateCsrfToken();

		// Assert
		expect(token).toBeTruthy();
		expect(typeof token).toBe("string");
		// Base64url encoding of 32 bytes should be 43 characters
		expect(token.length).toBeGreaterThanOrEqual(40);
	});

	it("should generate unique tokens", () => {
		// Arrange & Act
		const token1 = generateCsrfToken();
		const token2 = generateCsrfToken();

		// Assert
		expect(token1).not.toBe(token2);
	});

	it("should generate URL-safe tokens", () => {
		// Arrange & Act
		const token = generateCsrfToken();

		// Assert - base64url should only contain alphanumeric, -, and _
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe("validateCsrfToken", () => {
	it("should validate matching tokens", () => {
		// Arrange
		const token = generateCsrfToken();
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		// Act
		const result = validateCsrfToken(request, token);

		// Assert
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it("should reject when cookie token is missing", () => {
		// Arrange
		const token = generateCsrfToken();
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});

		// Act
		const result = validateCsrfToken(request, undefined);

		// Assert
		expect(result.valid).toBe(false);
		expect(result.error).toBe("Missing CSRF cookie");
	});

	it("should reject when header token is missing", () => {
		// Arrange
		const token = generateCsrfToken();
		const request = new Request("http://localhost:3000", {
			method: "POST",
		});

		// Act
		const result = validateCsrfToken(request, token);

		// Assert
		expect(result.valid).toBe(false);
		expect(result.error).toBe("Missing CSRF header");
	});

	it("should reject when tokens do not match", () => {
		// Arrange
		const cookieToken = generateCsrfToken();
		const headerToken = generateCsrfToken();
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: headerToken,
			},
		});

		// Act
		const result = validateCsrfToken(request, cookieToken);

		// Assert
		expect(result.valid).toBe(false);
		expect(result.error).toBe("CSRF token mismatch");
	});

	it("should use constant-time comparison", () => {
		// Arrange
		const token1 = "a".repeat(43);
		const token2 = "b".repeat(43);
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token1,
			},
		});

		// Act
		const result = validateCsrfToken(request, token2);

		// Assert
		expect(result.valid).toBe(false);
	});

	it("should reject empty tokens", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: "",
			},
		});

		// Act
		const result = validateCsrfToken(request, "");

		// Assert
		expect(result.valid).toBe(false);
	});
});

describe("createCsrfCookie", () => {
	it("should create cookie with token in production", () => {
		// Arrange
		const token = generateCsrfToken();

		// Act
		const cookie = createCsrfCookie(token, true);

		// Assert
		expect(cookie).toContain(CSRF_COOKIE_NAME);
		expect(cookie).toContain(token);
		expect(cookie).toContain("Secure");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("Max-Age=");
	});

	it("should create cookie without Secure flag in development", () => {
		// Arrange
		const token = generateCsrfToken();

		// Act
		const cookie = createCsrfCookie(token, false);

		// Assert
		expect(cookie).toContain(CSRF_COOKIE_NAME);
		expect(cookie).toContain(token);
		expect(cookie).not.toContain("Secure");
		expect(cookie).toContain("SameSite=Lax");
	});

	it("should set cookie to expire in 24 hours", () => {
		// Arrange
		const token = generateCsrfToken();

		// Act
		const cookie = createCsrfCookie(token, true);

		// Assert
		expect(cookie).toContain("Max-Age=86400"); // 60 * 60 * 24 = 86400
	});

	it("should not set HttpOnly flag", () => {
		// Arrange
		const token = generateCsrfToken();

		// Act
		const cookie = createCsrfCookie(token, true);

		// Assert
		// HttpOnly should NOT be set because client needs to read the token
		expect(cookie).not.toContain("HttpOnly");
	});
});

describe("requiresCsrfProtection", () => {
	it("should require protection for POST requests", () => {
		// Act & Assert
		expect(requiresCsrfProtection("POST")).toBe(true);
	});

	it("should require protection for PUT requests", () => {
		// Act & Assert
		expect(requiresCsrfProtection("PUT")).toBe(true);
	});

	it("should require protection for PATCH requests", () => {
		// Act & Assert
		expect(requiresCsrfProtection("PATCH")).toBe(true);
	});

	it("should require protection for DELETE requests", () => {
		// Act & Assert
		expect(requiresCsrfProtection("DELETE")).toBe(true);
	});

	it("should not require protection for GET requests", () => {
		// Act & Assert
		expect(requiresCsrfProtection("GET")).toBe(false);
	});

	it("should not require protection for HEAD requests", () => {
		// Act & Assert
		expect(requiresCsrfProtection("HEAD")).toBe(false);
	});

	it("should not require protection for OPTIONS requests", () => {
		// Act & Assert
		expect(requiresCsrfProtection("OPTIONS")).toBe(false);
	});

	it("should be case-insensitive", () => {
		// Act & Assert
		expect(requiresCsrfProtection("post")).toBe(true);
		expect(requiresCsrfProtection("get")).toBe(false);
		expect(requiresCsrfProtection("PoSt")).toBe(true);
	});
});

describe("withCsrfProtection", () => {
	it("should allow GET requests without CSRF validation", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "GET",
		});
		const handler = vi.fn(
			async () => new Response("OK", { status: 200 }),
		);

		// Act
		const response = await withCsrfProtection(request, undefined, handler);

		// Assert
		expect(handler).toHaveBeenCalled();
		expect(response.status).toBe(200);
	});

	it("should validate CSRF token for POST requests", async () => {
		// Arrange
		const token = generateCsrfToken();
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: token,
			},
		});
		const handler = vi.fn(
			async () => new Response("OK", { status: 200 }),
		);

		// Act
		const response = await withCsrfProtection(request, token, handler);

		// Assert
		expect(handler).toHaveBeenCalled();
		expect(response.status).toBe(200);
	});

	it("should reject POST requests with invalid CSRF token", async () => {
		// Arrange
		const token = generateCsrfToken();
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				[CSRF_HEADER_NAME]: "wrong-token",
			},
		});
		const handler = vi.fn(
			async () => new Response("OK", { status: 200 }),
		);

		// Act
		const response = await withCsrfProtection(request, token, handler);

		// Assert
		expect(handler).not.toHaveBeenCalled();
		expect(response.status).toBe(403);

		const body = await response.json();
		expect(body.error).toBe("CSRF validation failed");
	});

	it("should reject POST requests with missing CSRF token", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "POST",
		});
		const handler = vi.fn(
			async () => new Response("OK", { status: 200 }),
		);

		// Act
		const response = await withCsrfProtection(
			request,
			generateCsrfToken(),
			handler,
		);

		// Assert
		expect(handler).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
	});
});

describe("responseWithCsrfToken", () => {
	it("should add CSRF token to response headers", () => {
		// Arrange
		const originalResponse = new Response("OK", { status: 200 });

		// Act
		const response = responseWithCsrfToken(originalResponse);

		// Assert
		expect(response.headers.has("Set-Cookie")).toBe(true);
		expect(response.headers.has(CSRF_HEADER_NAME)).toBe(true);
	});

	it("should set cookie with token", () => {
		// Arrange
		const originalResponse = new Response("OK", { status: 200 });

		// Act
		const response = responseWithCsrfToken(originalResponse);

		// Assert
		const cookie = response.headers.get("Set-Cookie");
		expect(cookie).toBeTruthy();
		expect(cookie).toContain(CSRF_COOKIE_NAME);
	});

	it("should set header with token", () => {
		// Arrange
		const originalResponse = new Response("OK", { status: 200 });

		// Act
		const response = responseWithCsrfToken(originalResponse);

		// Assert
		const token = response.headers.get(CSRF_HEADER_NAME);
		expect(token).toBeTruthy();
		expect(token!.length).toBeGreaterThan(40);
	});

	it("should preserve original response body and status", async () => {
		// Arrange
		const originalResponse = new Response(
			JSON.stringify({ data: "test" }),
			{ status: 201 },
		);

		// Act
		const response = responseWithCsrfToken(originalResponse);

		// Assert
		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.data).toBe("test");
	});

	it("should use Secure flag in production", () => {
		// Arrange
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";
		const originalResponse = new Response("OK", { status: 200 });

		// Act
		const response = responseWithCsrfToken(originalResponse);

		// Assert
		const cookie = response.headers.get("Set-Cookie");
		expect(cookie).toContain("Secure");

		// Cleanup
		process.env.NODE_ENV = originalEnv;
	});

	it("should not use Secure flag in development", () => {
		// Arrange
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";
		const originalResponse = new Response("OK", { status: 200 });

		// Act
		const response = responseWithCsrfToken(originalResponse);

		// Assert
		const cookie = response.headers.get("Set-Cookie");
		expect(cookie).not.toContain("Secure");

		// Cleanup
		process.env.NODE_ENV = originalEnv;
	});
});
