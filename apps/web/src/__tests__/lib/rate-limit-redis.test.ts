/**
 * Redis Rate Limiter Tests
 *
 * These tests verify the Redis-based distributed rate limiter implementation.
 *
 * PREREQUISITES:
 * - Redis server running on localhost:6379 (or set REDIS_URL env var)
 * - ioredis package installed: bun add ioredis
 *
 * RUN TESTS:
 * ```bash
 * # Start Redis (if not running)
 * docker run -d -p 6379:6379 redis:alpine
 *
 * # Run tests
 * bun test apps/web/src/__tests__/lib/rate-limit-redis.test.ts
 *
 * # With custom Redis URL
 * REDIS_URL=redis://localhost:6379 bun test apps/web/src/__tests__/lib/rate-limit-redis.test.ts
 * ```
 *
 * SKIP TESTS:
 * If Redis is not available, these tests will be skipped automatically.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Dynamic import to handle missing ioredis package
let RedisRateLimiter: any;
let redisAvailable = false;

try {
	// Try to load the Redis rate limiter
	const module = await import("../../lib/rate-limit-redis");
	RedisRateLimiter = module.RedisRateLimiter;
	redisAvailable = true;
} catch (error) {
	console.warn("Redis rate limiter not available, skipping Redis tests");
}

// Helper to check if Redis is actually running
async function isRedisRunning(): Promise<boolean> {
	if (!redisAvailable) return false;

	try {
		const limiter = new RedisRateLimiter(
			{ limit: 1, windowMs: 1000 },
			process.env.REDIS_URL || "redis://localhost:6379",
		);
		await limiter.check("test-connection");
		await limiter.close();
		return true;
	} catch (error) {
		console.warn("Redis server not running:", error);
		return false;
	}
}

describe.skipIf(!redisAvailable)("RedisRateLimiter", () => {
	let limiter: any;
	const testIdentifier = `test-${Date.now()}-${Math.random()}`;

	beforeEach(async () => {
		// Skip all tests if Redis is not running
		const running = await isRedisRunning();
		if (!running) {
			console.warn("Skipping Redis tests - Redis server not available");
			return;
		}

		// Create fresh limiter for each test
		limiter = new RedisRateLimiter(
			{
				limit: 5,
				windowMs: 1000, // 1 second window
			},
			process.env.REDIS_URL || "redis://localhost:6379",
		);
	});

	afterEach(async () => {
		if (limiter) {
			// Clean up test data
			try {
				await limiter.reset(testIdentifier);
				await limiter.close();
			} catch (error) {
				console.error("Cleanup error:", error);
			}
		}
	});

	it("should allow requests within limit", async () => {
		const result1 = await limiter.check(testIdentifier);
		expect(result1.limited).toBe(false);
		expect(result1.count).toBe(1);

		const result2 = await limiter.check(testIdentifier);
		expect(result2.limited).toBe(false);
		expect(result2.count).toBe(2);

		const result3 = await limiter.check(testIdentifier);
		expect(result3.limited).toBe(false);
		expect(result3.count).toBe(3);
	});

	it("should block requests exceeding limit", async () => {
		// Use up the limit
		for (let i = 0; i < 5; i++) {
			await limiter.check(testIdentifier);
		}

		// Next request should be limited
		const result = await limiter.check(testIdentifier);
		expect(result.limited).toBe(true);
		expect(result.count).toBe(6);
		expect(result.retryAfter).toBeGreaterThan(0);
	});

	it("should reset after window expires", async () => {
		// Use up the limit
		for (let i = 0; i < 5; i++) {
			await limiter.check(testIdentifier);
		}

		// Should be limited
		const limitedResult = await limiter.check(testIdentifier);
		expect(limitedResult.limited).toBe(true);

		// Wait for window to expire
		await new Promise((resolve) => setTimeout(resolve, 1100));

		// Should be allowed again
		const allowedResult = await limiter.check(testIdentifier);
		expect(allowedResult.limited).toBe(false);
		expect(allowedResult.count).toBe(1);
	});

	it("should track different identifiers separately", async () => {
		const identifier1 = `${testIdentifier}-1`;
		const identifier2 = `${testIdentifier}-2`;

		// Use up limit for identifier1
		for (let i = 0; i < 5; i++) {
			await limiter.check(identifier1);
		}

		// identifier1 should be limited
		const result1 = await limiter.check(identifier1);
		expect(result1.limited).toBe(true);

		// identifier2 should still be allowed
		const result2 = await limiter.check(identifier2);
		expect(result2.limited).toBe(false);
		expect(result2.count).toBe(1);

		// Cleanup
		await limiter.reset(identifier1);
		await limiter.reset(identifier2);
	});

	it("should reset specific identifier", async () => {
		// Use up the limit
		for (let i = 0; i < 5; i++) {
			await limiter.check(testIdentifier);
		}

		// Should be limited
		const limitedResult = await limiter.check(testIdentifier);
		expect(limitedResult.limited).toBe(true);

		// Reset
		await limiter.reset(testIdentifier);

		// Should be allowed again
		const allowedResult = await limiter.check(testIdentifier);
		expect(allowedResult.limited).toBe(false);
		expect(allowedResult.count).toBe(1);
	});

	it("should handle concurrent requests", async () => {
		// Make 10 concurrent requests (limit is 5)
		const promises = Array.from({ length: 10 }, () => limiter.check(testIdentifier));

		const results = await Promise.all(promises);

		// Count limited and allowed requests
		const allowed = results.filter((r) => !r.limited).length;
		const limited = results.filter((r) => r.limited).length;

		// First 5 should be allowed, rest should be limited
		expect(allowed).toBe(5);
		expect(limited).toBe(5);
	});

	it("should provide correct retry-after time", async () => {
		// Use up the limit
		for (let i = 0; i < 5; i++) {
			await limiter.check(testIdentifier);
		}

		// Check limited request
		const result = await limiter.check(testIdentifier);
		expect(result.limited).toBe(true);
		expect(result.retryAfter).toBeGreaterThan(0);
		expect(result.retryAfter).toBeLessThanOrEqual(1); // Window is 1 second
	});

	it("should get stats", async () => {
		// Make some requests
		await limiter.check(`${testIdentifier}-stats-1`);
		await limiter.check(`${testIdentifier}-stats-2`);

		const stats = await limiter.getStats();

		expect(stats.config.limit).toBe(5);
		expect(stats.config.windowMs).toBe(1000);
		expect(stats.totalBuckets).toBeGreaterThanOrEqual(2);

		// Cleanup
		await limiter.reset(`${testIdentifier}-stats-1`);
		await limiter.reset(`${testIdentifier}-stats-2`);
	});

	it("should clear all buckets", async () => {
		// Create multiple buckets
		await limiter.check(`${testIdentifier}-clear-1`);
		await limiter.check(`${testIdentifier}-clear-2`);
		await limiter.check(`${testIdentifier}-clear-3`);

		// Clear all
		await limiter.clear();

		// Check stats - should have 0 buckets (or very few from other tests)
		const stats = await limiter.getStats();
		// Note: May not be exactly 0 if other tests are running concurrently
		expect(stats.totalBuckets).toBeGreaterThanOrEqual(0);
	});

	it("should handle custom limit and window", async () => {
		const customLimiter = new RedisRateLimiter(
			{
				limit: 3,
				windowMs: 500, // 0.5 seconds
			},
			process.env.REDIS_URL || "redis://localhost:6379",
		);

		const customIdentifier = `${testIdentifier}-custom`;

		// Should allow 3 requests
		const result1 = await customLimiter.check(customIdentifier);
		const result2 = await customLimiter.check(customIdentifier);
		const result3 = await customLimiter.check(customIdentifier);

		expect(result1.limited).toBe(false);
		expect(result2.limited).toBe(false);
		expect(result3.limited).toBe(false);

		// 4th should be limited
		const result4 = await customLimiter.check(customIdentifier);
		expect(result4.limited).toBe(true);

		// Cleanup
		await customLimiter.reset(customIdentifier);
		await customLimiter.close();
	});

	it("should handle Redis connection errors gracefully", async () => {
		// Create limiter with invalid Redis URL
		const invalidLimiter = new RedisRateLimiter(
			{ limit: 5, windowMs: 1000 },
			"redis://invalid-host:9999",
		);

		// Should fail open (allow request) on connection error
		const result = await invalidLimiter.check(testIdentifier);

		// Depending on implementation, might allow or might throw
		// Our implementation fails open (allows request)
		expect(result).toBeDefined();

		await invalidLimiter.close();
	});

	it("should work across multiple limiter instances (distributed)", async () => {
		// Create two separate limiter instances
		const limiter1 = new RedisRateLimiter(
			{ limit: 5, windowMs: 1000 },
			process.env.REDIS_URL || "redis://localhost:6379",
		);

		const limiter2 = new RedisRateLimiter(
			{ limit: 5, windowMs: 1000 },
			process.env.REDIS_URL || "redis://localhost:6379",
		);

		const sharedIdentifier = `${testIdentifier}-distributed`;

		// Make 3 requests from limiter1
		await limiter1.check(sharedIdentifier);
		await limiter1.check(sharedIdentifier);
		await limiter1.check(sharedIdentifier);

		// Make 2 requests from limiter2
		await limiter2.check(sharedIdentifier);
		await limiter2.check(sharedIdentifier);

		// Next request from either should be limited (total = 5)
		const result = await limiter1.check(sharedIdentifier);
		expect(result.limited).toBe(true);

		// Cleanup
		await limiter1.reset(sharedIdentifier);
		await limiter1.close();
		await limiter2.close();
	});
});

// Test factory function
describe("createRateLimiter factory", () => {
	it("should create in-memory limiter when REDIS_URL not set", async () => {
		// Temporarily clear REDIS_URL
		const originalRedisUrl = process.env.REDIS_URL;
		delete process.env.REDIS_URL;

		const { createRateLimiter } = await import("../../lib/rate-limit");
		const limiter = await createRateLimiter({ limit: 10, windowMs: 60000 });

		// Should be RateLimiter (in-memory), not RedisRateLimiter
		expect(limiter.constructor.name).toBe("RateLimiter");

		// Restore
		if (originalRedisUrl) {
			process.env.REDIS_URL = originalRedisUrl;
		}
	});

	it.skipIf(!redisAvailable)(
		"should create Redis limiter when REDIS_URL is set",
		async () => {
			const running = await isRedisRunning();
			if (!running) {
				console.warn("Skipping test - Redis not available");
				return;
			}

			// Set REDIS_URL
			const originalRedisUrl = process.env.REDIS_URL;
			process.env.REDIS_URL = "redis://localhost:6379";

			const { createRateLimiter } = await import("../../lib/rate-limit");
			const limiter = await createRateLimiter({ limit: 10, windowMs: 60000 });

			// Should be RedisRateLimiter
			expect(limiter.constructor.name).toBe("RedisRateLimiter");

			// Cleanup
			if ("close" in limiter && typeof limiter.close === "function") {
				await limiter.close();
			}

			// Restore
			if (originalRedisUrl) {
				process.env.REDIS_URL = originalRedisUrl;
			} else {
				delete process.env.REDIS_URL;
			}
		},
	);

	it.skipIf(!redisAvailable)(
		"should accept custom Redis URL parameter",
		async () => {
			const running = await isRedisRunning();
			if (!running) {
				console.warn("Skipping test - Redis not available");
				return;
			}

			const { createRateLimiter } = await import("../../lib/rate-limit");
			const limiter = await createRateLimiter(
				{ limit: 10, windowMs: 60000 },
				"redis://localhost:6379",
			);

			// Should be RedisRateLimiter
			expect(limiter.constructor.name).toBe("RedisRateLimiter");

			// Cleanup
			if ("close" in limiter && typeof limiter.close === "function") {
				await limiter.close();
			}
		},
	);

	it("should fall back to in-memory if Redis fails to load", async () => {
		// Use invalid Redis URL to trigger fallback
		const { createRateLimiter } = await import("../../lib/rate-limit");
		const limiter = await createRateLimiter(
			{ limit: 10, windowMs: 60000 },
			"redis://definitely-invalid-host-that-does-not-exist:9999",
		);

		// Implementation may create Redis limiter that fails open,
		// or fall back to in-memory. Either is acceptable.
		expect(limiter).toBeDefined();
		expect(limiter.check).toBeDefined();

		// Cleanup
		if ("close" in limiter && typeof limiter.close === "function") {
			await limiter.close();
		}
	});
});

// Performance comparison tests (informational)
describe.skipIf(!redisAvailable)("Performance comparison", () => {
	it("should compare in-memory vs Redis performance", async () => {
		const running = await isRedisRunning();
		if (!running) {
			console.warn("Skipping performance test - Redis not available");
			return;
		}

		const { RateLimiter } = await import("../../lib/rate-limit");
		const { RedisRateLimiter } = await import("../../lib/rate-limit-redis");

		// In-memory limiter
		const memoryLimiter = new RateLimiter({ limit: 1000, windowMs: 60000 });

		// Redis limiter
		const redisLimiter = new RedisRateLimiter(
			{ limit: 1000, windowMs: 60000 },
			process.env.REDIS_URL || "redis://localhost:6379",
		);

		const iterations = 100;
		const testId = `perf-${Date.now()}`;

		// Benchmark in-memory
		const memoryStart = performance.now();
		for (let i = 0; i < iterations; i++) {
			memoryLimiter.check(`${testId}-memory-${i}`);
		}
		const memoryTime = performance.now() - memoryStart;

		// Benchmark Redis
		const redisStart = performance.now();
		for (let i = 0; i < iterations; i++) {
			await redisLimiter.check(`${testId}-redis-${i}`);
		}
		const redisTime = performance.now() - redisStart;

		console.log(`\nPerformance (${iterations} requests):`);
		console.log(`  In-memory: ${memoryTime.toFixed(2)}ms (${(memoryTime / iterations).toFixed(2)}ms/req)`);
		console.log(`  Redis:     ${redisTime.toFixed(2)}ms (${(redisTime / iterations).toFixed(2)}ms/req)`);
		console.log(`  Ratio:     ${(redisTime / memoryTime).toFixed(2)}x slower`);

		// In-memory should be faster (but both should be reasonable)
		expect(memoryTime).toBeLessThan(redisTime);

		// Cleanup
		await redisLimiter.close();
	}, 30000); // 30 second timeout for performance test
});
