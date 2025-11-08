/**
 * Unit Tests for Rate Limiting
 *
 * Tests IP-based rate limiting, bucket management, and bot detection.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	RateLimiter,
	getClientIp,
	createRateLimitHeaders,
	validateUserAgent,
} from "../rate-limit";

describe("RateLimiter", () => {
	describe("check", () => {
		it("should allow first request", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 10, windowMs: 60000 });

			// Act
			const result = limiter.check("test-ip");

			// Assert
			expect(result.limited).toBe(false);
			expect(result.count).toBe(1);
			expect(result.resetAt).toBeDefined();
		});

		it("should increment count for subsequent requests", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 10, windowMs: 60000 });

			// Act
			const result1 = limiter.check("test-ip");
			const result2 = limiter.check("test-ip");
			const result3 = limiter.check("test-ip");

			// Assert
			expect(result1.count).toBe(1);
			expect(result2.count).toBe(2);
			expect(result3.count).toBe(3);
		});

		it("should limit after reaching threshold", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 3, windowMs: 60000 });

			// Act
			limiter.check("test-ip");
			limiter.check("test-ip");
			limiter.check("test-ip");
			const result = limiter.check("test-ip");

			// Assert
			expect(result.limited).toBe(true);
			expect(result.retryAfter).toBeDefined();
			expect(result.retryAfter!).toBeGreaterThan(0);
		});

		it("should isolate limits per identifier", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 2, windowMs: 60000 });

			// Act
			limiter.check("ip-1");
			limiter.check("ip-1");
			const result1 = limiter.check("ip-1");

			limiter.check("ip-2");
			const result2 = limiter.check("ip-2");

			// Assert
			expect(result1.limited).toBe(true);
			expect(result2.limited).toBe(false);
		});

		it("should reset after window expires", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 2, windowMs: 100 });
			vi.useFakeTimers();

			// Act
			limiter.check("test-ip");
			limiter.check("test-ip");
			const result1 = limiter.check("test-ip");

			// Advance time past window
			vi.advanceTimersByTime(101);

			const result2 = limiter.check("test-ip");

			// Assert
			expect(result1.limited).toBe(true);
			expect(result2.limited).toBe(false);
			expect(result2.count).toBe(1);

			vi.useRealTimers();
		});

		it("should calculate retry-after correctly", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 2, windowMs: 60000 });
			vi.useFakeTimers();

			// Act
			limiter.check("test-ip");
			limiter.check("test-ip");
			const result = limiter.check("test-ip");

			// Assert
			expect(result.limited).toBe(true);
			expect(result.retryAfter).toBeGreaterThan(0);
			expect(result.retryAfter).toBeLessThanOrEqual(60);

			vi.useRealTimers();
		});

		it("should handle concurrent requests", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 5, windowMs: 60000 });

			// Act
			const results = Array.from({ length: 10 }, () =>
				limiter.check("test-ip"),
			);

			// Assert
			const limited = results.filter((r) => r.limited);
			const allowed = results.filter((r) => !r.limited);

			expect(allowed.length).toBe(5);
			expect(limited.length).toBe(5);
		});

		it("should enforce minimum limit of 1", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 0, windowMs: 60000 });

			// Act
			const result = limiter.check("test-ip");

			// Assert
			expect(result.limited).toBe(false);
			expect(result.count).toBe(1);
		});

		it("should enforce minimum window of 1000ms", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 10, windowMs: 500 });

			// Act
			const stats = limiter.getStats();

			// Assert
			expect(stats.config.windowMs).toBe(1000);
		});

		it("should cleanup expired buckets", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 10, windowMs: 100 });
			vi.useFakeTimers();

			// Act
			limiter.check("ip-1");
			limiter.check("ip-2");
			limiter.check("ip-3");

			let stats = limiter.getStats();
			expect(stats.totalBuckets).toBe(3);

			// Advance time past window and trigger cleanup
			vi.advanceTimersByTime(101);
			limiter.check("ip-4");

			stats = limiter.getStats();
			expect(stats.totalBuckets).toBeLessThan(4); // Old buckets cleaned up

			vi.useRealTimers();
		});

		it("should enforce max buckets limit", () => {
			// Arrange
			const limiter = new RateLimiter({
				limit: 10,
				windowMs: 60000,
				maxBuckets: 5,
			});

			// Act
			for (let i = 0; i < 10; i++) {
				limiter.check(`ip-${i}`);
			}

			const stats = limiter.getStats();

			// Assert
			expect(stats.totalBuckets).toBeLessThanOrEqual(5);
		});

		it("should use default maxBuckets of 10,000", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 10, windowMs: 60000 });

			// Act
			const stats = limiter.getStats();

			// Assert
			expect(stats.config.maxBuckets).toBe(10_000);
		});
	});

	describe("reset", () => {
		it("should reset specific identifier", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 2, windowMs: 60000 });
			limiter.check("test-ip");
			limiter.check("test-ip");

			// Act
			limiter.reset("test-ip");
			const result = limiter.check("test-ip");

			// Assert
			expect(result.limited).toBe(false);
			expect(result.count).toBe(1);
		});

		it("should not affect other identifiers", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 2, windowMs: 60000 });
			limiter.check("ip-1");
			limiter.check("ip-1");
			limiter.check("ip-2");
			limiter.check("ip-2");

			// Act
			limiter.reset("ip-1");
			const result1 = limiter.check("ip-1");
			const result2 = limiter.check("ip-2");

			// Assert
			expect(result1.limited).toBe(false);
			expect(result2.limited).toBe(true);
		});
	});

	describe("clear", () => {
		it("should clear all buckets", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 10, windowMs: 60000 });
			limiter.check("ip-1");
			limiter.check("ip-2");
			limiter.check("ip-3");

			// Act
			limiter.clear();
			const stats = limiter.getStats();

			// Assert
			expect(stats.totalBuckets).toBe(0);
		});

		it("should allow fresh start after clear", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 2, windowMs: 60000 });
			limiter.check("test-ip");
			limiter.check("test-ip");
			limiter.check("test-ip");

			// Act
			limiter.clear();
			const result = limiter.check("test-ip");

			// Assert
			expect(result.limited).toBe(false);
			expect(result.count).toBe(1);
		});
	});

	describe("getStats", () => {
		it("should return accurate bucket count", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 10, windowMs: 60000 });

			// Act
			limiter.check("ip-1");
			limiter.check("ip-2");
			limiter.check("ip-3");
			const stats = limiter.getStats();

			// Assert
			expect(stats.totalBuckets).toBe(3);
		});

		it("should return config", () => {
			// Arrange
			const limiter = new RateLimiter({ limit: 5, windowMs: 30000 });

			// Act
			const stats = limiter.getStats();

			// Assert
			expect(stats.config.limit).toBe(5);
			expect(stats.config.windowMs).toBe(30000);
		});
	});
});

describe("getClientIp", () => {
	it("should extract IP from x-forwarded-for header", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			headers: {
				"x-forwarded-for": "192.168.1.1, 10.0.0.1",
			},
		});

		// Act
		const ip = getClientIp(request);

		// Assert
		expect(ip).toBe("192.168.1.1");
	});

	it("should extract IP from x-real-ip header", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			headers: {
				"x-real-ip": "192.168.1.1",
			},
		});

		// Act
		const ip = getClientIp(request, "x-real-ip");

		// Assert
		expect(ip).toBe("192.168.1.1");
	});

	it("should fallback to x-real-ip when x-forwarded-for missing", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			headers: {
				"x-real-ip": "192.168.1.1",
			},
		});

		// Act
		const ip = getClientIp(request, "x-forwarded-for");

		// Assert
		expect(ip).toBe("192.168.1.1");
	});

	it("should use strict mode for untrusted proxies", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			headers: {
				"x-forwarded-for": "spoofed-ip",
			},
		});

		// Act
		const ip = getClientIp(request, "strict");

		// Assert
		expect(ip).toBe("localhost");
	});

	it("should trim whitespace from forwarded IPs", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			headers: {
				"x-forwarded-for": "  192.168.1.1  , 10.0.0.1",
			},
		});

		// Act
		const ip = getClientIp(request);

		// Assert
		expect(ip).toBe("192.168.1.1");
	});

	it("should return hostname as fallback", () => {
		// Arrange
		const request = new Request("http://example.com:3000");

		// Act
		const ip = getClientIp(request);

		// Assert
		expect(ip).toBe("example.com");
	});

	it("should handle invalid URL gracefully", () => {
		// Arrange
		const request = new Request("http://localhost:3000");

		// Act
		const ip = getClientIp(request, "strict");

		// Assert
		expect(ip).toBeDefined();
	});
});

describe("createRateLimitHeaders", () => {
	it("should create headers for allowed request", () => {
		// Arrange
		const result = { limited: false, count: 3, resetAt: Date.now() + 60000 };
		const config = { limit: 10, windowMs: 60000 };

		// Act
		const headers = createRateLimitHeaders(result, config);

		// Assert
		expect(headers["X-RateLimit-Limit"]).toBe("10");
		expect(headers["X-RateLimit-Window"]).toBe("60000");
		expect(headers["X-RateLimit-Remaining"]).toBe("7");
		expect(headers["Retry-After"]).toBeUndefined();
	});

	it("should create headers for limited request", () => {
		// Arrange
		const result = {
			limited: true,
			count: 10,
			resetAt: Date.now() + 60000,
			retryAfter: 60,
		};
		const config = { limit: 10, windowMs: 60000 };

		// Act
		const headers = createRateLimitHeaders(result, config);

		// Assert
		expect(headers["X-RateLimit-Limit"]).toBe("10");
		expect(headers["X-RateLimit-Remaining"]).toBe("0");
		expect(headers["Retry-After"]).toBe("60");
	});

	it("should handle first request", () => {
		// Arrange
		const result = { limited: false, count: 1, resetAt: Date.now() + 60000 };
		const config = { limit: 10, windowMs: 60000 };

		// Act
		const headers = createRateLimitHeaders(result, config);

		// Assert
		expect(headers["X-RateLimit-Remaining"]).toBe("9");
	});
});

describe("validateUserAgent", () => {
	it("should reject missing User-Agent", () => {
		// Act
		const result = validateUserAgent(null);

		// Assert
		expect(result.valid).toBe(false);
		expect(result.isSuspiciousBot).toBe(true);
		expect(result.reason).toBe("Missing or empty User-Agent");
	});

	it("should reject empty User-Agent", () => {
		// Act
		const result = validateUserAgent("");

		// Assert
		expect(result.valid).toBe(false);
		expect(result.isSuspiciousBot).toBe(true);
	});

	it("should accept legitimate browsers", () => {
		// Arrange
		const userAgents = [
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
			"Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
		];

		// Act & Assert
		for (const ua of userAgents) {
			const result = validateUserAgent(ua);
			expect(result.valid).toBe(true);
			expect(result.isSuspiciousBot).toBe(false);
		}
	});

	it("should detect suspicious bots", () => {
		// Arrange
		const userAgents = [
			"curl/7.64.1",
			"wget/1.20.3",
			"python-requests/2.25.1",
			"node-fetch/2.6.1",
			"HeadlessChrome/91.0.4472.124",
		];

		// Act & Assert
		for (const ua of userAgents) {
			const result = validateUserAgent(ua);
			expect(result.valid).toBe(false);
			expect(result.isSuspiciousBot).toBe(true);
		}
	});

	it("should allow legitimate search engine bots", () => {
		// Arrange
		const userAgents = [
			"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
			"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
			"Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
		];

		// Act & Assert
		for (const ua of userAgents) {
			const result = validateUserAgent(ua);
			expect(result.valid).toBe(true);
			expect(result.isLegitimateBot).toBe(true);
			expect(result.isSuspiciousBot).toBe(false);
		}
	});

	it("should detect malicious scanners", () => {
		// Arrange
		const userAgents = ["masscan/1.0", "nmap", "sqlmap", "nikto"];

		// Act & Assert
		for (const ua of userAgents) {
			const result = validateUserAgent(ua);
			expect(result.valid).toBe(false);
			expect(result.isSuspiciousBot).toBe(true);
		}
	});

	it("should be case-insensitive", () => {
		// Arrange
		const userAgents = ["CURL/7.64.1", "Curl/7.64.1", "curl/7.64.1"];

		// Act & Assert
		for (const ua of userAgents) {
			const result = validateUserAgent(ua);
			expect(result.isSuspiciousBot).toBe(true);
		}
	});

	it("should detect generic bot patterns", () => {
		// Arrange
		const userAgents = [
			"MyBot/1.0",
			"WebCrawler/2.0",
			"Spider-Bot",
			"Scraper Tool",
		];

		// Act & Assert
		for (const ua of userAgents) {
			const result = validateUserAgent(ua);
			expect(result.isSuspiciousBot).toBe(true);
		}
	});
});
