/**
 * Rate Limiting Utility
 *
 * Provides IP-based rate limiting for API endpoints.
 * Suitable for single-instance deployments. For production multi-instance/serverless,
 * consider using Redis or a distributed rate limiter.
 */

type RateBucket = {
	count: number;
	resetAt: number;
};

export type RateLimitConfig = {
	/** Maximum number of requests allowed within the window */
	limit: number;
	/** Time window in milliseconds */
	windowMs: number;
	/** Maximum number of buckets to track (prevents memory leaks) */
	maxBuckets?: number;
};

export type RateLimitResult = {
	/** Whether the request is rate limited */
	limited: boolean;
	/** Seconds until the rate limit resets (if limited) */
	retryAfter?: number;
	/** Current count for this identifier */
	count?: number;
	/** When the bucket resets */
	resetAt?: number;
};

export class RateLimiter {
	private buckets: Map<string, RateBucket>;
	private config: Required<RateLimitConfig>;
	private lastCleanup: number;

	constructor(config: RateLimitConfig) {
		this.buckets = new Map();
		this.config = {
			limit: Math.max(1, config.limit),
			windowMs: Math.max(1000, config.windowMs),
			maxBuckets: config.maxBuckets ?? 10_000,
		};
		this.lastCleanup = 0;
	}

	/**
	 * Clean up expired buckets and enforce max bucket limit
	 */
	private cleanup(now: number): void {
		// Lazy cleanup to avoid setInterval in serverless
		const keysToDelete: string[] = [];

		this.buckets.forEach((bucket, key) => {
			if (now > bucket.resetAt) {
				keysToDelete.push(key);
			}
		});

		keysToDelete.forEach((key) => this.buckets.delete(key));

		// If still too many buckets, remove oldest entries
		if (this.buckets.size > this.config.maxBuckets) {
			const excess = this.buckets.size - this.config.maxBuckets;
			let removed = 0;
			const keys = Array.from(this.buckets.keys());
			for (const key of keys) {
				this.buckets.delete(key);
				if (++removed >= excess) break;
			}
		}

		this.lastCleanup = now;
	}

	/**
	 * Check if an identifier is rate limited
	 *
	 * @param identifier - Unique identifier (e.g., IP address, user ID)
	 * @returns Rate limit result
	 */
	check(identifier: string): RateLimitResult {
		const now = Date.now();

		// Periodic cleanup
		if (now - this.lastCleanup > this.config.windowMs) {
			this.cleanup(now);
		}

		const bucket = this.buckets.get(identifier);

		// Create new bucket if expired or doesn't exist
		if (!bucket || now > bucket.resetAt) {
			const resetAt = now + this.config.windowMs;
			this.buckets.set(identifier, { count: 1, resetAt });
			return {
				limited: false,
				count: 1,
				resetAt,
			};
		}

		// Check if limit exceeded
		if (bucket.count >= this.config.limit) {
			return {
				limited: true,
				retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
				count: bucket.count,
				resetAt: bucket.resetAt,
			};
		}

		// Increment counter
		bucket.count += 1;
		return {
			limited: false,
			count: bucket.count,
			resetAt: bucket.resetAt,
		};
	}

	/**
	 * Reset rate limit for a specific identifier
	 */
	reset(identifier: string): void {
		this.buckets.delete(identifier);
	}

	/**
	 * Clear all rate limit buckets
	 */
	clear(): void {
		this.buckets.clear();
		this.lastCleanup = 0;
	}

	/**
	 * Get current bucket stats
	 */
	getStats(): { totalBuckets: number; config: Required<RateLimitConfig> } {
		return {
			totalBuckets: this.buckets.size,
			config: this.config,
		};
	}
}

export type IpExtractionStrategy = "x-forwarded-for" | "x-real-ip" | "strict";

/**
 * Extract client IP from request
 *
 * SECURITY WARNING: IP-based rate limiting can be spoofed if not behind a trusted proxy.
 *
 * X-Forwarded-For and X-Real-IP headers can be set by clients unless your infrastructure
 * overwrites them. This is only secure if:
 * 1. Your app runs behind a trusted reverse proxy (nginx, cloudflare, etc.)
 * 2. The proxy is configured to overwrite these headers with the actual client IP
 * 3. Direct client access to your app is blocked (only proxy can reach it)
 *
 * For production deployments:
 * - Use strategy: "strict" if NOT behind a trusted proxy (prevents header spoofing)
 * - Use strategy: "x-forwarded-for" or "x-real-ip" if behind a trusted proxy
 * - Consider additional rate limiting strategies (user ID, API key, etc.)
 * - Implement network-level protection (firewall rules, DDoS protection)
 *
 * @param request - The incoming request
 * @param strategy - IP extraction strategy (default: "x-forwarded-for")
 */
export function getClientIp(
	request: Request,
	strategy: IpExtractionStrategy = "x-forwarded-for",
): string {
	// Strict mode: Don't trust any headers, only use connection info
	// Use this if NOT behind a trusted proxy to prevent IP spoofing
	if (strategy === "strict") {
		try {
			const url = new URL(request.url);
			return url.hostname;
		} catch {
			return "127.0.0.1";
		}
	}

	// Check forwarded headers (from proxy/load balancer)
	if (strategy === "x-forwarded-for") {
		const forwarded = request.headers.get("x-forwarded-for");
		if (forwarded) {
			// Take first IP in the chain (leftmost is the original client)
			return forwarded.split(",")[0]!.trim();
		}
	}

	// Check real IP header
	if (strategy === "x-real-ip" || strategy === "x-forwarded-for") {
		const realIp = request.headers.get("x-real-ip");
		if (realIp) {
			return realIp.trim();
		}
	}

	// Fallback to URL hostname
	try {
		const url = new URL(request.url);
		return url.hostname;
	} catch {
		return "127.0.0.1";
	}
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): HeadersInit {
	return {
		"X-RateLimit-Limit": config.limit.toString(),
		"X-RateLimit-Window": config.windowMs.toString(),
		"X-RateLimit-Remaining": result.limited
			? "0"
			: (config.limit - (result.count ?? 1)).toString(),
		...(result.retryAfter && { "Retry-After": result.retryAfter.toString() }),
	};
}
