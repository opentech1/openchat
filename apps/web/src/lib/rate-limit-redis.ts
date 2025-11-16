/**
 * Redis-based distributed rate limiter
 *
 * Use this for multi-instance deployments where rate limits need to be
 * shared across multiple servers.
 *
 * Setup:
 * 1. Install: bun add ioredis
 * 2. Set REDIS_URL environment variable
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
 * - Pipeline operations minimize round trips (4 commands in 1 request)
 * - Sorted set operations are O(log N) where N = requests in window
 * - Memory usage is bounded by window size and request rate
 * - Typical latency: 1-5ms for local Redis, 10-50ms for remote
 *
 * RELIABILITY:
 * - Redis connection failures will throw errors (handle in caller)
 * - Consider connection pooling for high-throughput scenarios
 * - Set appropriate Redis maxmemory-policy (allkeys-lru recommended)
 * - Monitor Redis memory usage and eviction rates
 *
 * @see rate-limit.ts for single-instance in-memory implementation
 */

import type { RateLimitConfig, RateLimitResult } from "./rate-limit";

// Lazy load Redis to avoid import errors when not installed
let Redis: typeof import("ioredis").Redis;

async function loadRedis() {
	if (!Redis) {
		try {
			const ioredis = await import("ioredis");
			Redis = ioredis.Redis;
		} catch (_error) {
			throw new Error(
				"ioredis package not found. Install it with: bun add ioredis\n" +
					"Or remove REDIS_URL from environment to use in-memory rate limiting.",
			);
		}
	}
	return Redis;
}

export class RedisRateLimiter {
	private redis: InstanceType<typeof Redis> | null = null;
	private config: Required<RateLimitConfig>;
	private initPromise: Promise<void> | null = null;

	constructor(config: RateLimitConfig, redisUrl?: string) {
		this.config = {
			limit: Math.max(1, config.limit),
			windowMs: Math.max(1000, config.windowMs),
			maxBuckets: config.maxBuckets ?? 10_000, // Not used in Redis (no memory limit)
		};

		// Initialize Redis asynchronously
		this.initPromise = this.initRedis(redisUrl);
	}

	private async initRedis(redisUrl?: string): Promise<void> {
		const RedisClass = await loadRedis();
		const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";

		this.redis = new RedisClass(url, {
			// Connection options for reliability
			maxRetriesPerRequest: 3,
			retryStrategy(times: number) {
				// Exponential backoff: 50ms, 100ms, 200ms, etc.
				const delay = Math.min(times * 50, 2000);
				return delay;
			},
			// Reconnect on error
			reconnectOnError(err: Error) {
				const targetError = "READONLY";
				if (err.message.includes(targetError)) {
					// Reconnect on READONLY errors (Redis replica promoted to master)
					return true;
				}
				return false;
			},
		});

		// Handle connection errors
		this.redis.on("error", (err: Error) => {
			console.error("Redis rate limiter connection error:", err);
		});
	}

	private async ensureReady(): Promise<InstanceType<typeof Redis>> {
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
			pipeline.zadd(key, now, `${now}-${Math.random()}`);

			// Count requests in current window
			pipeline.zcard(key);

			// Set expiry (cleanup stale keys)
			// Add buffer to window to ensure we don't lose entries
			pipeline.expire(key, Math.ceil(this.config.windowMs / 1000) + 10);

			const results = await pipeline.exec();

			// Pipeline returns array of [error, result] tuples
			// We need the ZCARD result (index 2)
			const count = (results?.[2]?.[1] as number) || 0;

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
		} catch (_error) {
			// Log error but don't block requests on Redis failures
			console.error("Redis rate limit check failed:", _error);
			// Fail open: allow request if Redis is down
			// Alternative: fail closed by returning { limited: true }
			return {
				limited: false,
				count: 1,
				resetAt: now + this.config.windowMs,
			};
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
	 * Call this on application shutdown to gracefully close connections.
	 * In serverless environments, connections will be reused across invocations.
	 */
	async close(): Promise<void> {
		if (this.redis) {
			try {
				await this.redis.quit();
				this.redis = null;
			} catch (_error) {
				console.error("Redis rate limiter close failed:", _error);
				// Force disconnect if graceful quit fails
				this.redis?.disconnect();
				this.redis = null;
			}
		}
	}
}
