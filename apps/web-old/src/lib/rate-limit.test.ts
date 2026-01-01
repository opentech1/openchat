/**
 * Unit Tests for Rate Limiting Utility
 *
 * Comprehensive test coverage for rate limiting functionality including:
 * - Request counting and limits
 * - Bucket expiration and reset
 * - Concurrent request handling
 * - Identifier isolation
 * - Memory management and cleanup
 * - IP extraction strategies
 * - User-Agent validation
 * - Rate limit headers
 *
 * Security Critical: This module protects against DoS attacks and abuse.
 */

import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import {
	RateLimiter,
	getClientIp,
	validateUserAgent,
	createRateLimitHeaders,
	createRateLimiter,
	type RateLimitConfig,
	type RateLimitResult,
} from "./rate-limit";

describe("RateLimiter - Basic Functionality", () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		limiter = new RateLimiter({
			limit: 5,
			windowMs: 10000,
		});
	});

	test("should allow first request", () => {
		const result = limiter.check("test-id");

		expect(result.limited).toBe(false);
		expect(result.count).toBe(1);
		expect(result.resetAt).toBeDefined();
	});

	test("should increment count on subsequent requests", () => {
		limiter.check("test-id");
		const result = limiter.check("test-id");

		expect(result.limited).toBe(false);
		expect(result.count).toBe(2);
	});

	test("should allow requests up to limit", () => {
		for (let i = 0; i < 5; i++) {
			const result = limiter.check("test-id");
			expect(result.limited).toBe(false);
			expect(result.count).toBe(i + 1);
		}
	});

	test("should block requests exceeding limit", () => {
		// Use up the limit
		for (let i = 0; i < 5; i++) {
			limiter.check("test-id");
		}

		// Next request should be blocked
		const result = limiter.check("test-id");

		expect(result.limited).toBe(true);
		expect(result.retryAfter).toBeDefined();
		expect(result.retryAfter).toBeGreaterThan(0);
	});

	test("should maintain count when limit exceeded", () => {
		for (let i = 0; i < 6; i++) {
			limiter.check("test-id");
		}

		const result = limiter.check("test-id");
		expect(result.limited).toBe(true);
		expect(result.count).toBe(5); // Count shouldn't increase beyond limit
	});

	test("should return retry-after in seconds", () => {
		for (let i = 0; i < 5; i++) {
			limiter.check("test-id");
		}

		const result = limiter.check("test-id");
		expect(result.retryAfter).toBeLessThanOrEqual(10);
		expect(result.retryAfter).toBeGreaterThan(0);
	});
});

describe("RateLimiter - Identifier Isolation", () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		limiter = new RateLimiter({
			limit: 3,
			windowMs: 10000,
		});
	});

	test("should track different identifiers separately", () => {
		// Use up limit for user1
		for (let i = 0; i < 3; i++) {
			limiter.check("user1");
		}
		const user1Result = limiter.check("user1");
		expect(user1Result.limited).toBe(true);

		// user2 should still be allowed
		const user2Result = limiter.check("user2");
		expect(user2Result.limited).toBe(false);
		expect(user2Result.count).toBe(1);
	});

	test("should handle empty identifier", () => {
		const result = limiter.check("");
		expect(result.limited).toBe(false);
		expect(result.count).toBe(1);
	});

	test("should handle special characters in identifier", () => {
		const specialIds = [
			"user@email.com",
			"192.168.1.1",
			"user:session:123",
			"user#$%^&*()",
			"用户123", // Chinese characters
		];

		for (const id of specialIds) {
			const result = limiter.check(id);
			expect(result.limited).toBe(false);
			expect(result.count).toBe(1);
		}
	});

	test("should handle very long identifiers", () => {
		const longId = "a".repeat(1000);
		const result = limiter.check(longId);
		expect(result.limited).toBe(false);
		expect(result.count).toBe(1);
	});

	test("should handle composite identifiers", () => {
		const compositeId = "ip:192.168.1.1|user:123|session:abc";
		for (let i = 0; i < 3; i++) {
			limiter.check(compositeId);
		}

		const result = limiter.check(compositeId);
		expect(result.limited).toBe(true);
	});
});

describe("RateLimiter - Window Expiration", () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		vi.useFakeTimers({ now: Date.now() });
		limiter = new RateLimiter({
			limit: 3,
			windowMs: 5000, // 5 seconds
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("should reset bucket after window expires", () => {
		// Use up the limit
		for (let i = 0; i < 3; i++) {
			limiter.check("test-id");
		}
		expect(limiter.check("test-id").limited).toBe(true);

		// Advance time past window
		vi.setSystemTime(Date.now() + 5001);

		// Should allow requests again
		const result = limiter.check("test-id");
		expect(result.limited).toBe(false);
		expect(result.count).toBe(1);
	});

	test("should not reset bucket before window expires", () => {
		for (let i = 0; i < 3; i++) {
			limiter.check("test-id");
		}

		// Advance time but not past window
		vi.setSystemTime(Date.now() + 4999);

		const result = limiter.check("test-id");
		expect(result.limited).toBe(true);
	});

	test("should create new bucket with fresh count after expiration", () => {
		limiter.check("test-id");
		limiter.check("test-id");

		vi.setSystemTime(Date.now() + 5001);

		const result = limiter.check("test-id");
		expect(result.count).toBe(1);
	});

	test("should update resetAt timestamp on new bucket", () => {
		const result1 = limiter.check("test-id");
		const resetAt1 = result1.resetAt!;

		vi.setSystemTime(Date.now() + 5001);

		const result2 = limiter.check("test-id");
		const resetAt2 = result2.resetAt!;

		expect(resetAt2).toBeGreaterThan(resetAt1);
	});
});

describe("RateLimiter - Cleanup and Memory Management", () => {
	beforeEach(() => {
		vi.useFakeTimers({ now: Date.now() });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("should cleanup expired buckets", () => {
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: 1000,
			maxBuckets: 100,
		});

		// Create multiple buckets
		for (let i = 0; i < 10; i++) {
			limiter.check(`user${i}`);
		}

		expect(limiter.getStats().totalBuckets).toBe(10);

		// Advance time past cleanup threshold
		vi.setSystemTime(Date.now() + 1001);

		// Trigger cleanup by checking any identifier
		limiter.check("trigger-cleanup");

		// Old buckets should be cleaned up
		expect(limiter.getStats().totalBuckets).toBe(1);
	});

	test("should enforce max bucket limit", () => {
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: 10000,
			maxBuckets: 5,
		});

		// Create more buckets than max
		for (let i = 0; i < 10; i++) {
			limiter.check(`user${i}`);
		}

		// Cleanup is triggered after windowMs passes and maxBuckets is exceeded
		// The check itself should trigger cleanup
		vi.setSystemTime(Date.now() + 10001);
		limiter.check("trigger");

		// Should have cleaned up old buckets
		expect(limiter.getStats().totalBuckets).toBeLessThanOrEqual(5);
	});

	test("should remove oldest buckets when exceeding limit", () => {
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: 10000,
			maxBuckets: 3,
		});

		// Create buckets
		limiter.check("user1");
		limiter.check("user2");
		limiter.check("user3");
		limiter.check("user4"); // This creates the 4th bucket

		// Advance time to trigger cleanup
		vi.setSystemTime(Date.now() + 10001);
		limiter.check("trigger");

		expect(limiter.getStats().totalBuckets).toBeLessThanOrEqual(3);
	});

	test("should handle cleanup with empty buckets", () => {
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: 1000,
		});

		vi.setSystemTime(Date.now() + 1001);

		// Should not throw
		expect(() => limiter.check("test-id")).not.toThrow();
	});

	test("should perform periodic cleanup", () => {
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: 1000,
		});

		// Create expired bucket
		limiter.check("old-user");

		vi.setSystemTime(Date.now() + 1001);

		// Create new bucket (triggers cleanup)
		limiter.check("new-user");

		expect(limiter.getStats().totalBuckets).toBe(1);
	});
});

describe("RateLimiter - Configuration", () => {
	test("should accept valid configuration", () => {
		const limiter = new RateLimiter({
			limit: 100,
			windowMs: 60000,
			maxBuckets: 5000,
		});

		const stats = limiter.getStats();
		expect(stats.config.limit).toBe(100);
		expect(stats.config.windowMs).toBe(60000);
		expect(stats.config.maxBuckets).toBe(5000);
	});

	test("should use default maxBuckets if not provided", () => {
		const limiter = new RateLimiter({
			limit: 10,
			windowMs: 60000,
		});

		expect(limiter.getStats().config.maxBuckets).toBe(10000);
	});

	test("should enforce minimum limit of 1", () => {
		const limiter = new RateLimiter({
			limit: 0,
			windowMs: 60000,
		});

		expect(limiter.getStats().config.limit).toBe(1);
	});

	test("should enforce minimum windowMs of 1000", () => {
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: 500,
		});

		expect(limiter.getStats().config.windowMs).toBe(1000);
	});

	test("should handle negative limit", () => {
		const limiter = new RateLimiter({
			limit: -10,
			windowMs: 60000,
		});

		expect(limiter.getStats().config.limit).toBe(1);
	});

	test("should handle negative windowMs", () => {
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: -1000,
		});

		expect(limiter.getStats().config.windowMs).toBe(1000);
	});
});

describe("RateLimiter - Reset and Clear", () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		limiter = new RateLimiter({
			limit: 3,
			windowMs: 10000,
		});
	});

	test("should reset specific identifier", () => {
		for (let i = 0; i < 3; i++) {
			limiter.check("test-id");
		}
		expect(limiter.check("test-id").limited).toBe(true);

		limiter.reset("test-id");

		const result = limiter.check("test-id");
		expect(result.limited).toBe(false);
		expect(result.count).toBe(1);
	});

	test("should only reset specified identifier", () => {
		limiter.check("user1");
		limiter.check("user2");

		limiter.reset("user1");

		expect(limiter.getStats().totalBuckets).toBe(1);
	});

	test("should handle reset of non-existent identifier", () => {
		expect(() => limiter.reset("non-existent")).not.toThrow();
	});

	test("should clear all buckets", () => {
		limiter.check("user1");
		limiter.check("user2");
		limiter.check("user3");

		limiter.clear();

		expect(limiter.getStats().totalBuckets).toBe(0);
	});

	test("should reset cleanup timer on clear", () => {
		limiter.check("user1");
		limiter.clear();

		const stats = limiter.getStats();
		expect(stats.totalBuckets).toBe(0);
	});

	test("should allow requests after clear", () => {
		for (let i = 0; i < 3; i++) {
			limiter.check("test-id");
		}
		limiter.check("test-id");

		limiter.clear();

		const result = limiter.check("test-id");
		expect(result.limited).toBe(false);
		expect(result.count).toBe(1);
	});
});

describe("RateLimiter - Stats", () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		limiter = new RateLimiter({
			limit: 10,
			windowMs: 60000,
			maxBuckets: 1000,
		});
	});

	test("should return accurate bucket count", () => {
		limiter.check("user1");
		limiter.check("user2");
		limiter.check("user3");

		expect(limiter.getStats().totalBuckets).toBe(3);
	});

	test("should return configuration", () => {
		const stats = limiter.getStats();

		expect(stats.config).toEqual({
			limit: 10,
			windowMs: 60000,
			maxBuckets: 1000,
		});
	});

	test("should update bucket count dynamically", () => {
		expect(limiter.getStats().totalBuckets).toBe(0);

		limiter.check("user1");
		expect(limiter.getStats().totalBuckets).toBe(1);

		limiter.check("user2");
		expect(limiter.getStats().totalBuckets).toBe(2);

		limiter.reset("user1");
		expect(limiter.getStats().totalBuckets).toBe(1);
	});
});

describe("getClientIp", () => {
	test("should extract IP from x-forwarded-for header", () => {
		const request = new Request("http://example.com", {
			headers: {
				"x-forwarded-for": "203.0.113.1, 198.51.100.1",
			},
		});

		const ip = getClientIp(request, "x-forwarded-for");
		expect(ip).toBe("203.0.113.1");
	});

	test("should handle single IP in x-forwarded-for", () => {
		const request = new Request("http://example.com", {
			headers: {
				"x-forwarded-for": "203.0.113.1",
			},
		});

		const ip = getClientIp(request);
		expect(ip).toBe("203.0.113.1");
	});

	test("should trim whitespace from x-forwarded-for", () => {
		const request = new Request("http://example.com", {
			headers: {
				"x-forwarded-for": "  203.0.113.1  ",
			},
		});

		const ip = getClientIp(request);
		expect(ip).toBe("203.0.113.1");
	});

	test("should extract IP from x-real-ip header", () => {
		const request = new Request("http://example.com", {
			headers: {
				"x-real-ip": "203.0.113.1",
			},
		});

		const ip = getClientIp(request, "x-real-ip");
		expect(ip).toBe("203.0.113.1");
	});

	test("should prefer x-real-ip when both headers present", () => {
		const request = new Request("http://example.com", {
			headers: {
				"x-forwarded-for": "203.0.113.1",
				"x-real-ip": "198.51.100.1",
			},
		});

		const ip = getClientIp(request, "x-real-ip");
		expect(ip).toBe("198.51.100.1");
	});

	test("should fallback to x-real-ip when x-forwarded-for strategy", () => {
		const request = new Request("http://example.com", {
			headers: {
				"x-real-ip": "198.51.100.1",
			},
		});

		const ip = getClientIp(request, "x-forwarded-for");
		expect(ip).toBe("198.51.100.1");
	});

	test("should use URL hostname in strict mode", () => {
		const request = new Request("http://203.0.113.1:3000/api/test");

		const ip = getClientIp(request, "strict");
		expect(ip).toBe("203.0.113.1");
	});

	test("should ignore headers in strict mode", () => {
		const request = new Request("http://203.0.113.1:3000/api/test", {
			headers: {
				"x-forwarded-for": "malicious.ip",
				"x-real-ip": "spoofed.ip",
			},
		});

		const ip = getClientIp(request, "strict");
		expect(ip).toBe("203.0.113.1");
	});

	test("should handle invalid URL gracefully", () => {
		// Create request with potentially invalid URL
		const request = new Request("http://localhost");

		const ip = getClientIp(request, "strict");
		expect(ip).toBe("localhost");
	});

	test("should fallback to 127.0.0.1 on URL parse error", () => {
		const request = {
			url: "invalid-url",
			headers: new Headers(),
		} as Request;

		const ip = getClientIp(request, "strict");
		expect(ip).toBe("127.0.0.1");
	});

	test("should handle missing headers", () => {
		const request = new Request("http://example.com");

		const ip = getClientIp(request);
		expect(ip).toBe("example.com");
	});

	test("should handle IPv6 addresses", () => {
		const request = new Request("http://example.com", {
			headers: {
				"x-forwarded-for": "2001:db8::1",
			},
		});

		const ip = getClientIp(request);
		expect(ip).toBe("2001:db8::1");
	});

	test("should use default strategy when not specified", () => {
		const request = new Request("http://example.com", {
			headers: {
				"x-forwarded-for": "203.0.113.1",
			},
		});

		const ip = getClientIp(request);
		expect(ip).toBe("203.0.113.1");
	});
});

describe("validateUserAgent", () => {
	test("should validate normal browser user-agent", () => {
		const userAgent =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
		const result = validateUserAgent(userAgent);

		expect(result.valid).toBe(true);
		expect(result.isSuspiciousBot).toBe(false);
		expect(result.isLegitimateBot).toBe(false);
	});

	test("should detect missing user-agent", () => {
		const result = validateUserAgent(null);

		expect(result.valid).toBe(false);
		expect(result.isSuspiciousBot).toBe(true);
		expect(result.reason).toBe("Missing or empty User-Agent");
	});

	test("should detect empty user-agent", () => {
		const result = validateUserAgent("");

		expect(result.valid).toBe(false);
		expect(result.isSuspiciousBot).toBe(true);
	});

	test("should detect whitespace-only user-agent", () => {
		const result = validateUserAgent("   ");

		expect(result.valid).toBe(false);
		expect(result.isSuspiciousBot).toBe(true);
	});

	test("should allow Googlebot", () => {
		const result = validateUserAgent(
			"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		);

		expect(result.valid).toBe(true);
		expect(result.isLegitimateBot).toBe(true);
		expect(result.isSuspiciousBot).toBe(false);
	});

	test("should allow Bingbot", () => {
		const result = validateUserAgent(
			"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
		);

		expect(result.valid).toBe(true);
		expect(result.isLegitimateBot).toBe(true);
	});

	test("should allow social media bots", () => {
		const bots = [
			"Slackbot-LinkExpanding 1.0",
			"Twitterbot/1.0",
			"facebookexternalhit/1.1",
			"LinkedInBot/1.0",
			"Mozilla/5.0 (compatible; Discordbot/2.0)",
		];

		for (const bot of bots) {
			const result = validateUserAgent(bot);
			expect(result.valid).toBe(true);
			expect(result.isLegitimateBot).toBe(true);
		}
	});

	test("should detect curl", () => {
		const result = validateUserAgent("curl/7.68.0");

		expect(result.valid).toBe(false);
		expect(result.isSuspiciousBot).toBe(true);
	});

	test("should detect wget", () => {
		const result = validateUserAgent("Wget/1.20.3");

		expect(result.valid).toBe(false);
		expect(result.isSuspiciousBot).toBe(true);
	});

	test("should detect python-requests", () => {
		const result = validateUserAgent("python-requests/2.25.1");

		expect(result.valid).toBe(false);
		expect(result.isSuspiciousBot).toBe(true);
	});

	test("should detect headless browsers", () => {
		const headlessAgents = [
			"HeadlessChrome/91.0.4472.124",
			"PhantomJS/2.1.1",
		];

		for (const agent of headlessAgents) {
			const result = validateUserAgent(agent);
			expect(result.valid).toBe(false);
			expect(result.isSuspiciousBot).toBe(true);
		}
	});

	test("should detect malicious scanners", () => {
		const scanners = ["masscan/1.0", "nmap", "sqlmap/1.0", "nikto/2.1.6"];

		for (const scanner of scanners) {
			const result = validateUserAgent(scanner);
			expect(result.valid).toBe(false);
			expect(result.isSuspiciousBot).toBe(true);
		}
	});

	test("should detect generic bot patterns", () => {
		const bots = [
			"MyBot/1.0",
			"WebCrawler/1.0",
			"Spider/1.0",
			"Scraper/1.0",
		];

		for (const bot of bots) {
			const result = validateUserAgent(bot);
			expect(result.valid).toBe(false);
			expect(result.isSuspiciousBot).toBe(true);
		}
	});

	test("should be case-insensitive for bot detection", () => {
		const result1 = validateUserAgent("CURL/7.68.0");
		const result2 = validateUserAgent("CuRl/7.68.0");

		expect(result1.isSuspiciousBot).toBe(true);
		expect(result2.isSuspiciousBot).toBe(true);
	});

	test("should handle legitimate bots with bot keyword", () => {
		const result = validateUserAgent("Googlebot/2.1");

		expect(result.valid).toBe(true);
		expect(result.isLegitimateBot).toBe(true);
		expect(result.isSuspiciousBot).toBe(false);
	});
});

describe("createRateLimitHeaders", () => {
	test("should create headers for non-limited request", () => {
		const result: RateLimitResult = {
			limited: false,
			count: 3,
			resetAt: Date.now() + 60000,
		};

		const config: RateLimitConfig = {
			limit: 10,
			windowMs: 60000,
		};

		const headers = createRateLimitHeaders(result, config);

		expect(headers["X-RateLimit-Limit"]).toBe("10");
		expect(headers["X-RateLimit-Window"]).toBe("60000");
		expect(headers["X-RateLimit-Remaining"]).toBe("7");
	});

	test("should create headers for limited request", () => {
		const result: RateLimitResult = {
			limited: true,
			retryAfter: 30,
			count: 10,
			resetAt: Date.now() + 30000,
		};

		const config: RateLimitConfig = {
			limit: 10,
			windowMs: 60000,
		};

		const headers = createRateLimitHeaders(result, config);

		expect(headers["X-RateLimit-Remaining"]).toBe("0");
		expect(headers["Retry-After"]).toBe("30");
	});

	test("should not include Retry-After when not limited", () => {
		const result: RateLimitResult = {
			limited: false,
			count: 1,
		};

		const config: RateLimitConfig = {
			limit: 10,
			windowMs: 60000,
		};

		const headers = createRateLimitHeaders(result, config);

		expect(headers["Retry-After"]).toBeUndefined();
	});

	test("should handle first request correctly", () => {
		const result: RateLimitResult = {
			limited: false,
			count: 1,
		};

		const config: RateLimitConfig = {
			limit: 5,
			windowMs: 60000,
		};

		const headers = createRateLimitHeaders(result, config);

		expect(headers["X-RateLimit-Remaining"]).toBe("4");
	});

	test("should handle missing count in result", () => {
		const result: RateLimitResult = {
			limited: false,
		};

		const config: RateLimitConfig = {
			limit: 10,
			windowMs: 60000,
		};

		const headers = createRateLimitHeaders(result, config);

		expect(headers["X-RateLimit-Remaining"]).toBe("9");
	});
});

describe("createRateLimiter - Factory Function", () => {
	test("should create in-memory limiter by default", async () => {
		const limiter = await createRateLimiter({
			limit: 10,
			windowMs: 60000,
		});

		expect(limiter).toBeDefined();
		expect(limiter.check).toBeDefined();
	});

	test("should create in-memory limiter when mode is memory", async () => {
		const limiter = await createRateLimiter(
			{
				limit: 10,
				windowMs: 60000,
			},
			{ mode: "memory" },
		);

		const result = await limiter.check("test-id");
		expect(result.limited).toBe(false);
	});

	test("should handle async check method", async () => {
		const limiter = await createRateLimiter({
			limit: 5,
			windowMs: 60000,
		});

		const result = await limiter.check("test-id");
		expect(result).toHaveProperty("limited");
		expect(result).toHaveProperty("count");
	});

	test("should support reset method", async () => {
		const limiter = await createRateLimiter({
			limit: 5,
			windowMs: 60000,
		});

		await limiter.check("test-id");
		await limiter.reset("test-id");

		const result = await limiter.check("test-id");
		expect(result.count).toBe(1);
	});

	test("should support clear method", async () => {
		const limiter = await createRateLimiter({
			limit: 5,
			windowMs: 60000,
		});

		await limiter.check("user1");
		await limiter.check("user2");
		await limiter.clear();

		const stats = await limiter.getStats();
		expect(stats.totalBuckets).toBe(0);
	});

	test("should support getStats method", async () => {
		const limiter = await createRateLimiter({
			limit: 10,
			windowMs: 60000,
			maxBuckets: 1000,
		});

		const stats = await limiter.getStats();
		expect(stats.config.limit).toBe(10);
		expect(stats.config.windowMs).toBe(60000);
	});
});

describe("RateLimiter - Concurrent Requests", () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		limiter = new RateLimiter({
			limit: 100,
			windowMs: 60000,
		});
	});

	test("should handle concurrent requests for same identifier", () => {
		const promises = Array.from({ length: 50 }, () =>
			Promise.resolve(limiter.check("concurrent-user")),
		);

		return Promise.all(promises).then((results) => {
			// All requests should be processed
			expect(results).toHaveLength(50);

			// All should be allowed (under limit of 100)
			results.forEach((result) => {
				expect(result.limited).toBe(false);
			});
		});
	});

	test("should handle concurrent requests for different identifiers", () => {
		const promises = Array.from({ length: 100 }, (_, i) =>
			Promise.resolve(limiter.check(`user${i}`)),
		);

		return Promise.all(promises).then((results) => {
			expect(results).toHaveLength(100);

			// Each user should have count of 1
			results.forEach((result) => {
				expect(result.limited).toBe(false);
				expect(result.count).toBe(1);
			});
		});
	});

	test("should maintain accurate counts under concurrent load", () => {
		const userId = "stress-test-user";
		const requests = 100;

		// Make many concurrent requests
		const promises = Array.from({ length: requests }, () =>
			Promise.resolve(limiter.check(userId)),
		);

		return Promise.all(promises).then((results) => {
			const limitedCount = results.filter((r) => r.limited).length;
			const allowedCount = results.filter((r) => !r.limited).length;

			// Should allow exactly 100 requests (the limit)
			expect(allowedCount).toBe(100);
			expect(limitedCount).toBe(0);
		});
	});
});

describe("RateLimiter - Edge Cases", () => {
	test("should handle very short window", () => {
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: 100, // Will be enforced to minimum 1000ms
		});

		expect(limiter.getStats().config.windowMs).toBe(1000);
	});

	test("should handle very large limit", () => {
		const limiter = new RateLimiter({
			limit: 1000000,
			windowMs: 60000,
		});

		const result = limiter.check("test-id");
		expect(result.limited).toBe(false);
	});

	test("should handle very large window", () => {
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: 86400000, // 24 hours
		});

		expect(limiter.getStats().config.windowMs).toBe(86400000);
	});

	test("should handle limit of 1", () => {
		const limiter = new RateLimiter({
			limit: 1,
			windowMs: 60000,
		});

		const result1 = limiter.check("test-id");
		expect(result1.limited).toBe(false);

		const result2 = limiter.check("test-id");
		expect(result2.limited).toBe(true);
	});

	test("should handle rapid successive checks", () => {
		const limiter = new RateLimiter({
			limit: 1000,
			windowMs: 60000,
		});

		for (let i = 0; i < 500; i++) {
			const result = limiter.check("rapid-user");
			expect(result.limited).toBe(false);
		}

		const stats = limiter.getStats();
		expect(stats.totalBuckets).toBe(1);
	});

	test("should handle zero maxBuckets gracefully", () => {
		// maxBuckets should be set to default if 0
		const limiter = new RateLimiter({
			limit: 5,
			windowMs: 60000,
			maxBuckets: 0,
		});

		// Should still work (uses default or minimum value)
		expect(() => limiter.check("test-id")).not.toThrow();
	});
});
