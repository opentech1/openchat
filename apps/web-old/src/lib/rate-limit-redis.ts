/**
 * Redis-based distributed rate limiter using Upstash Redis REST API
 *
 * Use this for multi-instance deployments where rate limits need to be
 * shared across multiple servers. Optimized for serverless environments.
 *
 * Setup:
 * 1. Install: bun add @upstash/redis
 * 2. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables
 * 3. Update rate-limit.ts to use this implementation
 *
 * ALGORITHM:
 * - Uses Redis sorted sets with timestamps as scores
 * - Sliding window approach (automatically removes old entries)
 * - Atomic operations via Redis pipeline for thread-safety
 * - Automatic expiry prevents unbounded memory growth
 *
 * DISTRIBUTED CONSIDERATIONS:
 * - All instances share the same Redis backend
 * - Rate limits are enforced globally across all servers
 * - No cache coherency issues (single source of truth)
 * - Redis single-threaded nature ensures atomicity
 *
 * PERFORMANCE:
 * - REST API ideal for serverless (no persistent connections)
 * - Pipeline operations minimize round trips (4 commands in 1 request)
 * - Sorted set operations are O(log N) where N = requests in window
 * - Memory usage is bounded by window size and request rate
 * - Typical latency: 50-150ms for Upstash global edge network
 *
 * RELIABILITY:
 * - Redis connection failures will fail open (allow request) or fail closed (deny request) based on configuration
 * - Upstash provides automatic backups and high availability
 * - No connection pooling needed (REST API is stateless)
 * - Graceful degradation on Redis unavailability
 *
 * UPSTASH REDIS BENEFITS:
 * - Serverless-native (pay per request)
 * - Global edge network for low latency
 * - No connection limits (REST API)
 * - Automatic scaling and high availability
 * - Built-in metrics and monitoring
 *
 * @see rate-limit.ts for single-instance in-memory implementation
 */

import type { RateLimitConfig, RateLimitResult } from "./rate-limit";

// Lazy load Upstash Redis to avoid import errors when not installed
let UpstashRedis: typeof import("@upstash/redis").Redis;

async function loadUpstashRedis() {
	if (!UpstashRedis) {
		try {
			const upstashModule = await import("@upstash/redis");
			UpstashRedis = upstashModule.Redis;
		} catch (_error) {
			throw new Error(
				"@upstash/redis package not found. Install it with: bun add @upstash/redis\n" +
					"Or remove UPSTASH_REDIS_REST_URL from environment to use in-memory rate limiting.",
			);
		}
	}
	return UpstashRedis;
}

export class RedisRateLimiter {
	private redis: InstanceType<typeof UpstashRedis> | null = null;
	private config: Required<RateLimitConfig> & { failOpen: boolean };
	private initPromise: Promise<void> | null = null;

	constructor(config: RateLimitConfig & { failOpen?: boolean }, redisUrl?: string, redisToken?: string) {
		this.config = {
			limit: Math.max(1, config.limit),
			windowMs: Math.max(1000, config.windowMs),
			maxBuckets: config.maxBuckets ?? 10_000, // Not used in Redis (no memory limit)
			failOpen: config.failOpen ?? true, // Default to fail-open for better user experience
		};

		// Initialize Redis asynchronously
		this.initPromise = this.initRedis(redisUrl, redisToken);
	}

	private async initRedis(redisUrl?: string, redisToken?: string): Promise<void> {
		const RedisClass = await loadUpstashRedis();
		const url = redisUrl || process.env.UPSTASH_REDIS_REST_URL;
		const token = redisToken || process.env.UPSTASH_REDIS_REST_TOKEN;

		if (!url || !token) {
			throw new Error(
				"Missing Upstash Redis credentials. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.\n" +
					"Get credentials from: https://console.upstash.com/redis"
			);
		}

		this.redis = new RedisClass({
			url,
			token,
			// Upstash REST API options
			retry: {
				retries: 3,
				backoff: (retryCount) => Math.min(50 * Math.pow(2, retryCount), 2000),
			},
		});
	}

	private async ensureReady(): Promise<InstanceType<typeof UpstashRedis>> {
		if (this.initPromise) {
			await this.initPromise;
			this.initPromise = null;
		}
		if (!this.redis) {
			throw new Error("Redis client not initialized");
		}
		return this.redis;
	}

	/**
	 * Check if an identifier is rate limited
	 *
	 * REDIS OPERATIONS (atomic pipeline):
	 * 1. ZREMRANGEBYSCORE - Remove entries older than window
	 * 2. ZADD - Add current timestamp
	 * 3. ZCARD - Count total entries in window
	 * 4. EXPIRE - Set TTL to prevent unbounded memory growth
	 *
	 * TIME COMPLEXITY: O(log(N) + M) where:
	 * - N = total entries in sorted set
	 * - M = entries removed (typically few)
	 *
	 * @param identifier - Unique identifier (IP, user ID, API key, etc.)
	 * @returns Rate limit result
	 */
	async check(identifier: string): Promise<RateLimitResult> {
		const redis = await this.ensureReady();
		const key = `ratelimit:${identifier}`;
		const now = Date.now();
		const windowStart = now - this.config.windowMs;

		try {
			// Use Redis pipeline for atomic operations
			const pipeline = redis.pipeline();

			// Remove old entries outside the window
			pipeline.zremrangebyscore(key, 0, windowStart);

			// Add current request with unique member (timestamp + random)
			// This allows multiple requests at the same millisecond
			pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });

			// Count requests in current window
			pipeline.zcard(key);

			// Set expiry (cleanup stale keys)
			// Add buffer to window to ensure we don't lose entries
			pipeline.expire(key, Math.ceil(this.config.windowMs / 1000) + 10);

			const results = await pipeline.exec();

			// Upstash Redis pipeline returns array of results directly
			// Extract the ZCARD result (index 2)
			const count = (typeof results[2] === "number" ? results[2] : 0);

			const limited = count > this.config.limit;
			const resetAt = now + this.config.windowMs;

			if (limited) {
				return {
					limited: true,
					retryAfter: Math.ceil((resetAt - now) / 1000),
					count,
					resetAt,
				};
			}

			return {
				limited: false,
				count,
				resetAt,
			};
		} catch (error) {
			// Log error with details
			console.error("Redis rate limit check failed:", error);

			// Graceful degradation based on failOpen configuration
			if (this.config.failOpen) {
				// Fail open: allow request if Redis is down
				console.warn("Rate limiter failing open due to Redis error");
				return {
					limited: false,
					count: 1,
					resetAt: now + this.config.windowMs,
				};
			} else {
				// Fail closed: deny request if Redis is down
				console.warn("Rate limiter failing closed due to Redis error");
				return {
					limited: true,
					retryAfter: Math.ceil(this.config.windowMs / 1000),
					count: this.config.limit + 1,
					resetAt: now + this.config.windowMs,
				};
			}
		}
	}

	/**
	 * Reset rate limit for a specific identifier
	 *
	 * Useful for:
	 * - Testing
	 * - Admin overrides
	 * - User appeals
	 * - Clearing false positives
	 */
	async reset(identifier: string): Promise<void> {
		const redis = await this.ensureReady();
		const key = `ratelimit:${identifier}`;

		try {
			await redis.del(key);
		} catch (_error) {
			console.error("Redis rate limit reset failed:", _error);
			// Don't throw - reset is not critical
		}
	}

	/**
	 * Clear all rate limit buckets
	 *
	 * WARNING: This clears ALL rate limits, not just for this limiter instance.
	 * Use with extreme caution in production.
	 */
	async clear(): Promise<void> {
		const redis = await this.ensureReady();

		try {
			// Find all ratelimit keys
			const keys = await redis.keys("ratelimit:*");

			if (keys.length > 0) {
				// Delete in batches to avoid blocking Redis
				const batchSize = 1000;
				for (let i = 0; i < keys.length; i += batchSize) {
					const batch = keys.slice(i, i + batchSize);
					await redis.del(...batch);
				}
			}
		} catch (_error) {
			console.error("Redis rate limit clear failed:", _error);
			throw _error;
		}
	}

	/**
	 * Get current bucket stats
	 *
	 * Note: In Redis implementation, totalBuckets is expensive to compute
	 * (requires KEYS scan). Only call this for debugging/monitoring.
	 */
	async getStats(): Promise<{ totalBuckets: number; config: Required<RateLimitConfig> }> {
		const redis = await this.ensureReady();

		try {
			// WARNING: KEYS is expensive in production (O(N) scan)
			// For production monitoring, use Redis INFO or separate counter
			const keys = await redis.keys("ratelimit:*");

			return {
				totalBuckets: keys.length,
				config: this.config,
			};
		} catch (_error) {
			console.error("Redis rate limit stats failed:", _error);
			return {
				totalBuckets: 0,
				config: this.config,
			};
		}
	}

	/**
	 * Close Redis connection
	 *
	 * Note: Upstash Redis uses REST API (stateless), so there's no persistent
	 * connection to close. This method is provided for API compatibility.
	 * In serverless environments, the client is automatically cleaned up.
	 */
	async close(): Promise<void> {
		// Upstash Redis uses REST API - no persistent connection to close
		// Just clear the reference to allow garbage collection
		this.redis = null;
	}
}
