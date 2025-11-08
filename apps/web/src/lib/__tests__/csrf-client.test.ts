/**
 * Unit Tests for Client-Side CSRF Token Management
 *
 * Tests token caching, fetching, and automatic inclusion in requests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	getCsrfToken,
	clearCsrfToken,
	withCsrfToken,
	fetchWithCsrf,
	CSRF_HEADER_NAME,
} from "../csrf-client";

describe("getCsrfToken", () => {
	beforeEach(() => {
		clearCsrfToken();
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should fetch CSRF token from server", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			} as Response),
		);

		// Act
		const token = await getCsrfToken();

		// Assert
		expect(token).toBe(mockToken);
		expect(global.fetch).toHaveBeenCalledWith("/api/csrf");
	});

	it("should cache token after first fetch", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			} as Response),
		);

		// Act
		const token1 = await getCsrfToken();
		const token2 = await getCsrfToken();

		// Assert
		expect(token1).toBe(token2);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("should reuse in-flight request", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			} as Response),
		);

		// Act - Call getCsrfToken multiple times before first resolves
		const promises = [
			getCsrfToken(),
			getCsrfToken(),
			getCsrfToken(),
		];
		const tokens = await Promise.all(promises);

		// Assert
		expect(tokens[0]).toBe(mockToken);
		expect(tokens[1]).toBe(mockToken);
		expect(tokens[2]).toBe(mockToken);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("should throw error when fetch fails", async () => {
		// Arrange
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				status: 500,
			} as Response),
		);

		// Act & Assert
		await expect(getCsrfToken()).rejects.toThrow(
			"Failed to fetch CSRF token",
		);
	});

	it("should throw error when network fails", async () => {
		// Arrange
		global.fetch = vi.fn(() =>
			Promise.reject(new Error("Network error")),
		);

		// Act & Assert
		await expect(getCsrfToken()).rejects.toThrow("Network error");
	});

	it("should allow retry after failed fetch", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		global.fetch = vi
			.fn()
			.mockRejectedValueOnce(new Error("Network error"))
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			});

		// Act
		await expect(getCsrfToken()).rejects.toThrow("Network error");
		const token = await getCsrfToken();

		// Assert
		expect(token).toBe(mockToken);
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});
});

describe("clearCsrfToken", () => {
	beforeEach(() => {
		clearCsrfToken();
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should clear cached token", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			} as Response),
		);

		// Act
		await getCsrfToken();
		clearCsrfToken();
		await getCsrfToken();

		// Assert
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("should allow new fetch after clear", async () => {
		// Arrange
		const token1 = "first-token";
		const token2 = "second-token";
		global.fetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: token1 }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: token2 }),
			});

		// Act
		const firstToken = await getCsrfToken();
		clearCsrfToken();
		const secondToken = await getCsrfToken();

		// Assert
		expect(firstToken).toBe(token1);
		expect(secondToken).toBe(token2);
	});
});

describe("withCsrfToken", () => {
	beforeEach(() => {
		clearCsrfToken();
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should add CSRF token to headers", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			} as Response),
		);

		// Act
		const options = await withCsrfToken({ method: "POST" });

		// Assert
		expect(options.headers).toHaveProperty(CSRF_HEADER_NAME, mockToken);
	});

	it("should preserve existing headers", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			} as Response),
		);

		// Act
		const options = await withCsrfToken({
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
		});

		// Assert
		expect(options.headers).toHaveProperty("Content-Type", "application/json");
		expect(options.headers).toHaveProperty(CSRF_HEADER_NAME, mockToken);
	});

	it("should preserve other request options", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			} as Response),
		);

		// Act
		const options = await withCsrfToken({
			method: "POST",
			body: JSON.stringify({ data: "test" }),
			credentials: "include",
		});

		// Assert
		expect(options.method).toBe("POST");
		expect(options.body).toBe(JSON.stringify({ data: "test" }));
		expect(options.credentials).toBe("include");
	});

	it("should work with empty options", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			} as Response),
		);

		// Act
		const options = await withCsrfToken();

		// Assert
		expect(options.headers).toHaveProperty(CSRF_HEADER_NAME, mockToken);
	});
});

describe("fetchWithCsrf", () => {
	beforeEach(() => {
		clearCsrfToken();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should include CSRF token for POST requests", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		const mockFetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			});
		global.fetch = mockFetch;

		// Act
		await fetchWithCsrf("/api/test", {
			method: "POST",
			body: JSON.stringify({ data: "test" }),
		});

		// Assert
		expect(mockFetch).toHaveBeenCalledTimes(2); // Once for token, once for actual request
		const actualRequestCall = mockFetch.mock.calls[1];
		expect(actualRequestCall![0]).toBe("/api/test");
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			CSRF_HEADER_NAME,
			mockToken,
		);
	});

	it("should not include CSRF token for GET requests", async () => {
		// Arrange
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ data: "test" }),
		});
		global.fetch = mockFetch;

		// Act
		await fetchWithCsrf("/api/test", { method: "GET" });

		// Assert
		expect(mockFetch).toHaveBeenCalledTimes(1);
		const headers = mockFetch.mock.calls[0]![1]?.headers;
		expect(headers).not.toHaveProperty(CSRF_HEADER_NAME);
	});

	it("should include CSRF token for PUT requests", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		const mockFetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			});
		global.fetch = mockFetch;

		// Act
		await fetchWithCsrf("/api/test", { method: "PUT" });

		// Assert
		const actualRequestCall = mockFetch.mock.calls[1];
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			CSRF_HEADER_NAME,
			mockToken,
		);
	});

	it("should include CSRF token for DELETE requests", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		const mockFetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			});
		global.fetch = mockFetch;

		// Act
		await fetchWithCsrf("/api/test", { method: "DELETE" });

		// Assert
		const actualRequestCall = mockFetch.mock.calls[1];
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			CSRF_HEADER_NAME,
			mockToken,
		);
	});

	it("should include CSRF token for PATCH requests", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		const mockFetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			});
		global.fetch = mockFetch;

		// Act
		await fetchWithCsrf("/api/test", { method: "PATCH" });

		// Assert
		const actualRequestCall = mockFetch.mock.calls[1];
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			CSRF_HEADER_NAME,
			mockToken,
		);
	});

	it("should preserve existing headers", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		const mockFetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			});
		global.fetch = mockFetch;

		// Act
		await fetchWithCsrf("/api/test", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
		});

		// Assert
		const actualRequestCall = mockFetch.mock.calls[1];
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			"Content-Type",
			"application/json",
		);
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			CSRF_HEADER_NAME,
			mockToken,
		);
	});

	it("should handle Headers object", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		const mockFetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			});
		global.fetch = mockFetch;

		const headers = new Headers();
		headers.set("Content-Type", "application/json");

		// Act
		await fetchWithCsrf("/api/test", {
			method: "POST",
			headers,
		});

		// Assert
		const actualRequestCall = mockFetch.mock.calls[1];
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			"Content-Type",
			"application/json",
		);
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			CSRF_HEADER_NAME,
			mockToken,
		);
	});

	it("should handle array headers format", async () => {
		// Arrange
		const mockToken = "test-csrf-token-123";
		const mockFetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ token: mockToken }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			});
		global.fetch = mockFetch;

		// Act
		await fetchWithCsrf("/api/test", {
			method: "POST",
			headers: [["Content-Type", "application/json"]],
		});

		// Assert
		const actualRequestCall = mockFetch.mock.calls[1];
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			"Content-Type",
			"application/json",
		);
		expect(actualRequestCall![1]?.headers).toHaveProperty(
			CSRF_HEADER_NAME,
			mockToken,
		);
	});

	it("should default to GET when method not specified", async () => {
		// Arrange
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ data: "test" }),
		});
		global.fetch = mockFetch;

		// Act
		await fetchWithCsrf("/api/test");

		// Assert
		expect(mockFetch).toHaveBeenCalledTimes(1);
		const headers = mockFetch.mock.calls[0]![1]?.headers;
		expect(headers).not.toHaveProperty(CSRF_HEADER_NAME);
	});
});
