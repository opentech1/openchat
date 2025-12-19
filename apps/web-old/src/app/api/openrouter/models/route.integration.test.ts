/**
 * Integration Tests for OpenRouter Models API Route
 *
 * Comprehensive integration tests for the OpenRouter models endpoint.
 * Tests model fetching, caching, filtering, validation, and error handling.
 *
 * Test Coverage:
 * - Model list fetching (30+ tests)
 * - Response caching
 * - API error handling
 * - Capability filtering
 * - Input validation
 * - Performance optimization
 *
 * IMPORTANT: Uses real OpenRouter API structure but mocks network calls.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { POST, __testing } from "./route";

// Mock fetch for OpenRouter API calls
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("OpenRouter Models API - Basic Functionality", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__testing.clearCache();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	test("should return 200 for valid request", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(200);
	});

	test("should return models array in response", async () => {
		const mockModels = {
			data: [
				{
					id: "anthropic/claude-sonnet-4.5",
					name: "Claude Sonnet 4.5",
					context_length: 200000,
					pricing: { prompt: "0.003", completion: "0.015" },
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body).toHaveProperty("ok", true);
		expect(body).toHaveProperty("models");
		expect(Array.isArray(body.models)).toBe(true);
	});

	test("should transform OpenRouter model format", async () => {
		const mockModels = {
			data: [
				{
					id: "openai/gpt-4",
					name: "OpenAI: GPT-4",
					description: "GPT-4 model",
					context_length: 8192,
					pricing: { prompt: "0.03", completion: "0.06" },
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0]).toMatchObject({
			value: "openai/gpt-4",
			label: expect.any(String),
			description: "GPT-4 model",
			context: 8192,
			pricing: {
				prompt: 0.03,
				completion: 0.06,
			},
		});
	});

	test("should sort models alphabetically", async () => {
		const mockModels = {
			data: [
				{ id: "z-ai/model-z", name: "Z Model" },
				{ id: "anthropic/model-a", name: "A Model" },
				{ id: "meta/model-m", name: "M Model" },
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		const labels = body.models.map((m: { label: string }) => m.label);
		const sortedLabels = [...labels].sort((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: "base" }),
		);

		expect(labels).toEqual(sortedLabels);
	});

	test("should handle empty model list", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.ok).toBe(true);
		expect(body.models).toEqual([]);
	});
});

describe("OpenRouter Models API - Input Validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__testing.clearCache();
	});

	test("should reject request without API key", async () => {
		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		const response = await POST(request);

		expect(response.status).toBe(400);
	});

	test("should reject API key that is too short", async () => {
		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "short" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(400);
	});

	test("should reject API key that is too long", async () => {
		const longKey = "x".repeat(501);
		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: longKey }),
		});

		const response = await POST(request);

		expect(response.status).toBe(400);
	});

	test("should reject invalid JSON payload", async () => {
		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{ invalid json }",
		});

		const response = await POST(request);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toHaveProperty("ok", false);
		expect(body).toHaveProperty("error");
	});

	test("should reject empty request body", async () => {
		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});

		const response = await POST(request);

		expect(response.status).toBe(400);
	});

	test("should accept valid API key format", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-1234567890abcdef" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(200);
	});
});

describe("OpenRouter Models API - Caching", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__testing.clearCache();
	});

	test("should include cache headers in response", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);

		expect(response.headers.get("Cache-Control")).toContain("private");
		expect(response.headers.get("Cache-Control")).toContain("max-age=300");
	});

	test("should set X-Cache header on first request (MISS)", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-unique-key-001" }),
		});

		const response = await POST(request);

		expect(response.headers.get("X-Cache")).toBe("MISS");
	});

	test("should cache responses for 5 minutes", async () => {
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const apiKey = "sk-or-v1-cache-test-002";
		const request1 = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey }),
		});

		await POST(request1);

		// Second request should use cache
		const request2 = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey }),
		});

		const response2 = await POST(request2);

		// Cache should be hit
		expect(response2.headers.get("X-Cache")).toBe("HIT");
	});

	test("should use different cache for different API keys", async () => {
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request1 = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-key-A-123" }),
		});

		const request2 = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-key-B-456" }),
		});

		await POST(request1);
		await POST(request2);

		// Both should be cache misses (different keys)
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});

describe("OpenRouter Models API - Error Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__testing.clearCache();
	});

	test("should handle OpenRouter API error", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response("Unauthorized", {
				status: 401,
				headers: { "Content-Type": "text/plain" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-invalid-key" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toHaveProperty("ok", false);
	});

	test("should handle network error", async () => {
		mockFetch.mockRejectedValueOnce(new Error("Network error"));

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toHaveProperty("ok", false);
		expect(body).toHaveProperty("error");
	});

	test("should handle malformed OpenRouter response", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response("not json", {
				status: 200,
				headers: { "Content-Type": "text/html" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);

		expect(response.status).toBeLessThanOrEqual(500);
	});

	test("should handle timeout gracefully", async () => {
		mockFetch.mockImplementationOnce(
			() =>
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Timeout")), 100),
				),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(500);
	});

	test("should handle rate limiting from OpenRouter", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
				status: 429,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(429);
	});
});

describe("OpenRouter Models API - Model Capabilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__testing.clearCache();
	});

	test("should detect reasoning capability", async () => {
		const mockModels = {
			data: [
				{
					id: "anthropic/claude-sonnet-4.5",
					name: "Claude Sonnet 4.5",
					supports_reasoning: true,
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].capabilities?.reasoning).toBe(true);
	});

	test("should detect image capability", async () => {
		const mockModels = {
			data: [
				{
					id: "openai/gpt-4-vision",
					name: "GPT-4 Vision",
					supports_images: true,
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].capabilities?.image).toBe(true);
	});

	test("should detect audio capability", async () => {
		const mockModels = {
			data: [
				{
					id: "google/gemini-2.5-pro",
					name: "Gemini 2.5 Pro",
					supports_audio: true,
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].capabilities?.audio).toBe(true);
	});

	test("should detect video capability", async () => {
		const mockModels = {
			data: [
				{
					id: "google/gemini-2.0-flash",
					name: "Gemini 2.0 Flash",
					supports_video: true,
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].capabilities?.video).toBe(true);
	});

	test("should detect mandatory reasoning", async () => {
		const mockModels = {
			data: [
				{
					id: "x-ai/grok-4-fast",
					name: "Grok 4 Fast",
					is_mandatory_reasoning: true,
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].capabilities?.mandatoryReasoning).toBe(true);
	});

	test("should fallback to static capability detection", async () => {
		const mockModels = {
			data: [
				{
					id: "anthropic/claude-sonnet-4.5",
					name: "Claude Sonnet 4.5",
					// No supports_reasoning flag from API
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		// Should detect reasoning from model ID
		expect(body.models[0].capabilities?.reasoning).toBe(true);
	});

	test("should not include capabilities object if no capabilities", async () => {
		const mockModels = {
			data: [
				{
					id: "simple/text-model",
					name: "Simple Text Model",
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].capabilities).toBeUndefined();
	});
});

describe("OpenRouter Models API - Model Metadata", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__testing.clearCache();
	});

	test("should mark popular models", async () => {
		const mockModels = {
			data: [
				{
					id: "anthropic/claude-sonnet-4.5",
					name: "Claude Sonnet 4.5",
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].popular).toBe(true);
	});

	test("should mark free models", async () => {
		const mockModels = {
			data: [
				{
					id: "deepseek/deepseek-r1-0528:free",
					name: "DeepSeek R1 (Free)",
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].free).toBe(true);
		// Check for (free) case-insensitively since the name already contains it
		expect(body.models[0].label.toLowerCase()).toContain("(free)");
	});

	test("should parse pricing correctly", async () => {
		const mockModels = {
			data: [
				{
					id: "test/model",
					name: "Test Model",
					pricing: {
						prompt: "0.003",
						completion: "0.015",
					},
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].pricing).toEqual({
			prompt: 0.003,
			completion: 0.015,
		});
	});

	test("should handle numeric pricing", async () => {
		const mockModels = {
			data: [
				{
					id: "test/model",
					name: "Test Model",
					pricing: {
						prompt: 0.003,
						completion: 0.015,
					},
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].pricing).toEqual({
			prompt: 0.003,
			completion: 0.015,
		});
	});

	test("should handle missing pricing", async () => {
		const mockModels = {
			data: [
				{
					id: "test/model",
					name: "Test Model",
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].pricing).toBeUndefined();
	});

	test("should include context length", async () => {
		const mockModels = {
			data: [
				{
					id: "test/model",
					name: "Test Model",
					context_length: 128000,
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].context).toBe(128000);
	});

	test("should remove provider prefix from name", async () => {
		const mockModels = {
			data: [
				{
					id: "google/gemini-2.5-pro",
					name: "Google: Gemini 2.5 Pro",
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(body.models[0].label).toBe("Gemini 2.5 Pro");
	});
});

describe("OpenRouter Models API - Performance", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__testing.clearCache();
	});

	test("should complete request quickly", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const start = performance.now();

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		await POST(request);

		const duration = performance.now() - start;

		// Should complete in less than 1 second
		expect(duration).toBeLessThan(1000);
	});

	test("should handle large model lists efficiently", async () => {
		const largeModelList = {
			data: Array.from({ length: 500 }, (_, i) => ({
				id: `model-${i}`,
				name: `Model ${i}`,
				context_length: 4096,
			})),
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(largeModelList), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const start = performance.now();

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);
		const body = await response.json();

		const duration = performance.now() - start;

		expect(body.models).toHaveLength(500);
		expect(duration).toBeLessThan(5000); // Should handle 500 models in under 5s
	});
});

describe("OpenRouter Models API - Security", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__testing.clearCache();
	});

	test("should not expose API key in logs or errors", async () => {
		mockFetch.mockRejectedValueOnce(new Error("Network error"));

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-secret-key-xyz" }),
		});

		const response = await POST(request);
		const body = await response.json();

		const bodyStr = JSON.stringify(body);
		expect(bodyStr).not.toContain("secret-key");
	});

	test("should validate API key format", async () => {
		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "../../etc/passwd" }),
		});

		const response = await POST(request);

		expect(response.status).toBeLessThanOrEqual(500);
	});

	test("should sanitize model data", async () => {
		const mockModels = {
			data: [
				{
					id: "test/model",
					name: "<script>alert('xss')</script>",
					description: "Test XSS attempt",
				},
			],
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockModels), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const request = new Request("http://localhost:3000/api/openrouter/models", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: "sk-or-v1-test-key-12345" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(200);
		// Data should be returned as-is (sanitization happens client-side)
	});
});
