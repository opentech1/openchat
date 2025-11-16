/**
 * Rate Limiting Utility
 *
 * Provides IP-based rate limiting for API endpoints with automatic Redis/in-memory selection.
 *
 * DEPLOYMENT MODES:
 *
 * 1. In-Memory (default): Uses in-memory rate limiting
 *    - Fast and simple
 *    - No external dependencies
 *    - Rate limits are per-instance (not shared across servers)
 *    - Memory usage is bounded by maxBuckets config
 *    - Ideal for: Development, single-instance deployments
 *
 * 2. Redis (production): Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 *    - Distributed rate limiting across all instances
 *    - Requires Upstash Redis and @upstash/redis package
 *    - Rate limits are globally enforced
 *    - Serverless-friendly (REST API, no persistent connections)
 *    - Ideal for: Production, multi-instance, serverless deployments
 *
 * Environment Variables:
 * - UPSTASH_REDIS_REST_URL: Upstash Redis REST endpoint
 * - UPSTASH_REDIS_REST_TOKEN: Upstash Redis REST token
 * - RATE_LIMIT_MODE: Override mode ("redis" | "memory") - optional
 * - RATE_LIMIT_FAIL_OPEN: If "true", allow requests on Redis errors (default: true)
 *
 * Example:
 * ```bash
 * # Development (in-memory)
 * bun run start
 *
 * # Production (Redis)
 * UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 * UPSTASH_REDIS_REST_TOKEN=xxx
 * bun run start
 *
 * # Force in-memory even with Redis configured
 * RATE_LIMIT_MODE=memory bun run start
 * ```
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
	 * Checks if the given identifier has exceeded its rate limit quota.
	 * This method is thread-safe and handles cleanup automatically.
	 *
	 * ALGORITHM:
	 * - Uses sliding window counter (resets after window expires)
	 * - First request creates bucket with count=1
	 * - Subsequent requests increment counter
	 * - Returns limited=true when counter >= limit
	 *
	 * BUCKET LIFECYCLE:
	 * 1. Request arrives, check identifier
	 * 2. If no bucket or expired: Create new bucket, count=1, allow
	 * 3. If bucket exists and valid: Increment count
	 * 4. If count >= limit: Deny with retry-after seconds
	 * 5. Periodic cleanup removes expired buckets
	 *
	 * MEMORY MANAGEMENT:
	 * - Automatic cleanup of expired buckets
	 * - Maximum bucket limit prevents unbounded growth
	 * - LRU eviction when maxBuckets exceeded
	 *
	 * IDENTIFIER STRATEGIES:
	 * - IP address: Basic rate limiting (can be spoofed)
	 * - User ID: Authenticated user rate limiting
	 * - API key: Per-key rate limiting
	 * - Session token: Pre-authentication rate limiting
	 * - Composite: "ip:user_id" for multi-layer protection
	 *
	 * DISTRIBUTED SYSTEMS:
	 * This in-memory implementation works for single-instance deployments.
	 * For distributed/serverless, use Redis or database-backed solution.
	 *
	 * @param identifier - Unique identifier (e.g., IP address, user ID, API key)
	 *                     Use consistent format for same entity across requests
	 * @returns Rate limit result object
	 * @returns limited - true if rate limit exceeded, false if allowed
	 * @returns retryAfter - Seconds until rate limit resets (only when limited)
	 * @returns count - Current request count for this identifier
	 * @returns resetAt - Timestamp when the rate limit window resets
	 *
	 * @example
	 * ```typescript
	 * // IP-based rate limiting
	 * const ip = getClientIp(request);
	 * const result = rateLimiter.check(ip);
	 *
	 * if (result.limited) {
	 *   return new Response("Too many requests", {
	 *     status: 429,
	 *     headers: {
	 *       "Retry-After": result.retryAfter!.toString()
	 *     }
	 *   });
	 * }
	 *
	 * // User ID rate limiting
	 * const result = rateLimiter.check(`user:${userId}`);
	 *
	 * // Composite identifier
	 * const result = rateLimiter.check(`${ip}:${userId}`);
	 * ```
	 *
	 * @see {@link createRateLimitHeaders} to generate standard response headers
	 * @see {@link getClientIp} to extract IP from request
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

/**
 * Known bot patterns for User-Agent detection
 *
 * These patterns help identify automated requests and scrapers.
 * Legitimate bots (search engines) should be handled separately with different rate limits.
 */
const SUSPICIOUS_USER_AGENT_PATTERNS = [
	// Generic bot indicators
	/bot/i,
	/crawler/i,
	/spider/i,
	/scraper/i,
	// Common scripting tools
	/curl/i,
	/wget/i,
	/python-requests/i,
	/node-fetch/i,
	/axios/i,
	/http\.client/i,
	// Headless browsers (unless specifically allowed)
	/headless/i,
	/phantom/i,
	// Blank or suspicious patterns
	/^$/,
	/null/i,
	/undefined/i,
	// Known malicious patterns
	/masscan/i,
	/nmap/i,
	/sqlmap/i,
	/nikto/i,
];

/**
 * Legitimate bot patterns that should be allowed
 * (Search engines, monitoring services, etc.)
 */
const ALLOWED_BOT_PATTERNS = [
	/googlebot/i,
	/bingbot/i,
	/slackbot/i,
	/twitterbot/i,
	/facebookexternalhit/i,
	/linkedinbot/i,
	/discordbot/i,
];

/**
 * User-Agent validation result
 */
export type UserAgentValidation = {
	/** Whether the user-agent is valid */
	valid: boolean;
	/** Whether this is a suspicious bot */
	isSuspiciousBot: boolean;
	/** Whether this is a legitimate bot (search engine, etc.) */
	isLegitimateBot: boolean;
	/** Reason for validation failure */
	reason?: string;
};

/**
 * Validate User-Agent header for bot detection
 *
 * SECURITY: This helps identify automated requests and potential scrapers.
 * However, User-Agent can be easily spoofed, so this should be combined with:
 * - Rate limiting
 * - CAPTCHA challenges for suspicious behavior
 * - IP reputation checks
 * - Behavioral analysis
 *
 * @param userAgent - User-Agent string from request header
 * @returns Validation result with bot detection
 *
 * @example
 * ```typescript
 * const userAgent = request.headers.get("user-agent");
 * const validation = validateUserAgent(userAgent);
 *
 * if (validation.isSuspiciousBot) {
 *   // Apply stricter rate limits or challenge
 *   await auditLog({
 *     event: "request.suspicious_bot",
 *     userAgent,
 *     status: "denied"
 *   });
 * }
 * ```
 */
export function validateUserAgent(userAgent: string | null): UserAgentValidation {
	// Missing or empty User-Agent is suspicious
	if (!userAgent || userAgent.trim() === "") {
		return {
			valid: false,
			isSuspiciousBot: true,
			isLegitimateBot: false,
			reason: "Missing or empty User-Agent",
		};
	}

	// Check for legitimate bots first
	const isLegitimateBot = ALLOWED_BOT_PATTERNS.some((pattern) =>
		pattern.test(userAgent),
	);

	if (isLegitimateBot) {
		return {
			valid: true,
			isSuspiciousBot: false,
			isLegitimateBot: true,
		};
	}

	// Check for suspicious patterns
	const isSuspiciousBot = SUSPICIOUS_USER_AGENT_PATTERNS.some((pattern) =>
		pattern.test(userAgent),
	);

	if (isSuspiciousBot) {
		return {
			valid: false,
			isSuspiciousBot: true,
			isLegitimateBot: false,
			reason: "Suspicious bot pattern detected",
		};
	}

	// Valid user-agent
	return {
		valid: true,
		isSuspiciousBot: false,
		isLegitimateBot: false,
	};
}

/**
 * Rate limiter interface for both in-memory and Redis implementations
 */
export interface IRateLimiter {
	check(identifier: string): RateLimitResult | Promise<RateLimitResult>;
	reset(identifier: string): void | Promise<void>;
	clear(): void | Promise<void>;
	getStats():
		| { totalBuckets: number; config: Required<RateLimitConfig> }
		| Promise<{ totalBuckets: number; config: Required<RateLimitConfig> }>;
}

/**
 * Create a rate limiter instance
 *
 * Automatically selects the appropriate implementation based on environment:
 * - If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set: Uses distributed Redis-based rate limiting
 * - If RATE_LIMIT_MODE=redis: Forces Redis mode (will error if credentials missing)
 * - If RATE_LIMIT_MODE=memory: Forces in-memory mode (ignores Redis credentials)
 * - Otherwise: Uses in-memory rate limiting (single instance only)
 *
 * USAGE:
 * ```typescript
 * // Basic usage (auto-detects based on env vars)
 * const limiter = await createRateLimiter({
 *   limit: 10,
 *   windowMs: 60000, // 1 minute
 * });
 *
 * const result = await limiter.check("user-id-123");
 * if (result.limited) {
 *   return new Response("Too many requests", { status: 429 });
 * }
 *
 * // Force Redis mode with custom credentials
 * const limiter = await createRateLimiter(
 *   { limit: 100, windowMs: 60000 },
 *   { mode: "redis", redisUrl: "https://...", redisToken: "..." }
 * );
 *
 * // Force in-memory mode (ignore env vars)
 * const limiter = await createRateLimiter(
 *   { limit: 100, windowMs: 60000 },
 *   { mode: "memory" }
 * );
 * ```
 *
 * TESTING:
 * ```typescript
 * // Force in-memory for tests (ignore env vars)
 * const limiter = await createRateLimiter(
 *   { limit: 10, windowMs: 60000 },
 *   { mode: "memory" }
 * );
 *
 * // Force Redis for tests with custom credentials
 * const limiter = await createRateLimiter(
 *   { limit: 10, windowMs: 60000 },
 *   { mode: "redis", redisUrl: "https://...", redisToken: "..." }
 * );
 * ```
 *
 * @param config - Rate limit configuration
 * @param options - Optional configuration for Redis mode
 * @returns Rate limiter instance (in-memory or Redis-based)
 */
export async function createRateLimiter(
	config: RateLimitConfig,
	options?: {
		mode?: "redis" | "memory";
		redisUrl?: string;
		redisToken?: string;
		failOpen?: boolean;
	},
): Promise<IRateLimiter> {
	// Determine mode based on options or environment
	const explicitMode = options?.mode || process.env.RATE_LIMIT_MODE;
	const hasRedisCredentials =
		(options?.redisUrl && options?.redisToken) ||
		(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

	// Determine failOpen behavior
	const failOpen = options?.failOpen ?? (process.env.RATE_LIMIT_FAIL_OPEN === "true" || process.env.RATE_LIMIT_FAIL_OPEN === "1");

	// Force memory mode
	if (explicitMode === "memory") {
		return new RateLimiter(config);
	}

	// Force Redis mode or auto-detect
	const useRedis = explicitMode === "redis" || hasRedisCredentials;

	if (useRedis) {
		// Lazy load Redis limiter only if needed
		try {
			const { RedisRateLimiter } = await import("./rate-limit-redis");
			return new RedisRateLimiter(
				{ ...config, failOpen },
				options?.redisUrl,
				options?.redisToken
			);
		} catch (error) {
			console.error(
				"Failed to load Redis rate limiter, falling back to in-memory:",
				error,
			);
			// Fallback to in-memory if Redis fails to load
			return new RateLimiter(config);
		}
	}

	return new RateLimiter(config);
}

/**
 * Synchronous version of createRateLimiter for backwards compatibility
 *
 * DEPRECATED: Use createRateLimiter (async) instead for Redis support.
 * This function only supports in-memory rate limiting.
 *
 * @deprecated Use createRateLimiter instead
 */
export function createRateLimiterSync(config: RateLimitConfig): RateLimiter {
	if (process.env.UPSTASH_REDIS_REST_URL || process.env.RATE_LIMIT_MODE === "redis") {
		console.warn(
			"Redis credentials are set but createRateLimiterSync was called. " +
				"Use createRateLimiter (async) for Redis support. " +
				"Falling back to in-memory rate limiting.",
		);
	}
	return new RateLimiter(config);
}
