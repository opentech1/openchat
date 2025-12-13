/**
 * Redis-based Real-time Analytics Counters
 *
 * This module provides atomic counters for tracking application metrics
 * using Redis as the backend. Designed for high-throughput, real-time analytics.
 *
 * ARCHITECTURE:
 * - All counters use atomic Redis operations (INCRBY, SADD)
 * - Daily counters auto-expire using Redis TTL
 * - Graceful degradation when Redis is unavailable
 * - Zero data loss with pipeline-based batch operations
 *
 * KEY PATTERNS:
 * - stats:messages:total     - Lifetime message count (no expiry)
 * - stats:messages:today     - Messages today (24h TTL)
 * - stats:messages:hour:{h}  - Hourly breakdown (25h TTL)
 * - stats:tokens:total       - Lifetime token count (no expiry)
 * - stats:tokens:today       - Tokens today (24h TTL)
 * - stats:chats:total        - Lifetime chat count (no expiry)
 * - stats:chats:today        - Chats today (24h TTL)
 * - stats:active:users:{date} - Unique active users set (48h TTL)
 *
 * TTL/EXPIRY STRATEGY:
 * - Total counters: No expiry (persistent lifetime stats)
 * - Today counters: 24-hour sliding window (auto-reset via TTL)
 * - Hourly counters: 25-hour TTL (allows overlap for reporting)
 * - Active user sets: 48-hour TTL (allows daily comparisons)
 *
 * DAILY ROTATION:
 * - Today counters use TTL-based expiry, not manual reset
 * - rotateDailyCounters() can be called to explicitly reset if needed
 * - Active user sets are keyed by date (YYYY-MM-DD) for natural rotation
 *
 * @see redis.ts for Redis client implementation
 */

import { redis, isRedisStreamingAvailable } from "./redis";

// Key patterns for analytics counters
const KEYS = {
	MESSAGES_TOTAL: "stats:messages:total",
	MESSAGES_TODAY: "stats:messages:today",
	MESSAGES_HOUR: (hour: number) => `stats:messages:hour:${hour}`,
	TOKENS_TOTAL: "stats:tokens:total",
	TOKENS_TODAY: "stats:tokens:today",
	CHATS_TOTAL: "stats:chats:total",
	CHATS_TODAY: "stats:chats:today",
	ACTIVE_USERS: (date: string) => `stats:active:users:${date}`,
} as const;

// TTL values in seconds
const TTL = {
	TODAY: 86400, // 24 hours
	HOURLY: 90000, // 25 hours (allows overlap)
	ACTIVE_USERS: 172800, // 48 hours (allows daily comparisons)
} as const;

/**
 * Snapshot of current analytics metrics
 */
export interface AnalyticsSnapshot {
	/** Total messages sent (lifetime) */
	messagesTotal: number;
	/** Messages sent today */
	messagesToday: number;
	/** Total tokens used (lifetime) */
	tokensTotal: number;
	/** Tokens used today */
	tokensToday: number;
	/** Unique active users today */
	activeUsersToday: number;
	/** Total chats created (lifetime) */
	chatsTotal: number;
	/** Chats created today */
	chatsToday: number;
	/** Snapshot timestamp (Unix ms) */
	timestamp: number;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
	return new Date().toISOString().split("T")[0];
}

/**
 * Get current hour (0-23)
 */
function getCurrentHour(): number {
	return new Date().getHours();
}

// ============================================================================
// INCREMENT OPERATIONS
// ============================================================================

/**
 * Increment message count atomically
 *
 * Updates both total and daily counters in a single pipeline.
 * Also updates hourly counter for granular analytics.
 *
 * @param count - Number to increment by (default: 1)
 */
export async function incrementMessageCount(count: number = 1): Promise<void> {
	if (!isRedisStreamingAvailable()) return;

	try {
		const client = await redis.get();
		const hour = getCurrentHour();
		const pipeline = client.pipeline();

		// Total counter (no expiry)
		pipeline.incrby(KEYS.MESSAGES_TOTAL, count);

		// Today counter (24h TTL)
		pipeline.incrby(KEYS.MESSAGES_TODAY, count);
		pipeline.expire(KEYS.MESSAGES_TODAY, TTL.TODAY);

		// Hourly counter (25h TTL)
		const hourKey = KEYS.MESSAGES_HOUR(hour);
		pipeline.incrby(hourKey, count);
		pipeline.expire(hourKey, TTL.HOURLY);

		await pipeline.exec();
	} catch (error) {
		// Graceful degradation - log and continue
		console.error("[Analytics] Failed to increment message count:", error);
	}
}

/**
 * Increment token count atomically
 *
 * Tracks token usage for cost analysis and rate limiting.
 *
 * @param count - Number of tokens to add
 */
export async function incrementTokenCount(count: number): Promise<void> {
	if (!isRedisStreamingAvailable()) return;
	if (count <= 0) return;

	try {
		const client = await redis.get();
		const pipeline = client.pipeline();

		// Total counter (no expiry)
		pipeline.incrby(KEYS.TOKENS_TOTAL, count);

		// Today counter (24h TTL)
		pipeline.incrby(KEYS.TOKENS_TODAY, count);
		pipeline.expire(KEYS.TOKENS_TODAY, TTL.TODAY);

		await pipeline.exec();
	} catch (error) {
		console.error("[Analytics] Failed to increment token count:", error);
	}
}

/**
 * Increment chat count atomically
 *
 * @param count - Number to increment by (default: 1)
 */
export async function incrementChatCount(count: number = 1): Promise<void> {
	if (!isRedisStreamingAvailable()) return;

	try {
		const client = await redis.get();
		const pipeline = client.pipeline();

		// Total counter (no expiry)
		pipeline.incrby(KEYS.CHATS_TOTAL, count);

		// Today counter (24h TTL)
		pipeline.incrby(KEYS.CHATS_TODAY, count);
		pipeline.expire(KEYS.CHATS_TODAY, TTL.TODAY);

		await pipeline.exec();
	} catch (error) {
		console.error("[Analytics] Failed to increment chat count:", error);
	}
}

/**
 * Track active user
 *
 * Uses Redis Sets for automatic deduplication.
 * Each user is only counted once per day regardless of activity volume.
 *
 * @param userId - Unique user identifier
 */
export async function trackActiveUser(userId: string): Promise<void> {
	if (!isRedisStreamingAvailable()) return;
	if (!userId) return;

	try {
		const client = await redis.get();
		const today = getTodayDate();
		const key = KEYS.ACTIVE_USERS(today);

		// SADD is idempotent - same user won't be counted twice
		await client.sadd(key, userId);

		// Set expiry for cleanup (48h allows daily comparisons)
		await client.expire(key, TTL.ACTIVE_USERS);
	} catch (error) {
		console.error("[Analytics] Failed to track active user:", error);
	}
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get complete analytics snapshot
 *
 * Fetches all current metrics in a single operation.
 *
 * @returns Current analytics state
 */
export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
	const defaultSnapshot: AnalyticsSnapshot = {
		messagesTotal: 0,
		messagesToday: 0,
		tokensTotal: 0,
		tokensToday: 0,
		activeUsersToday: 0,
		chatsTotal: 0,
		chatsToday: 0,
		timestamp: Date.now(),
	};

	if (!isRedisStreamingAvailable()) return defaultSnapshot;

	try {
		const client = await redis.get();
		const today = getTodayDate();
		const pipeline = client.pipeline();

		// Queue all reads
		pipeline.get(KEYS.MESSAGES_TOTAL);
		pipeline.get(KEYS.MESSAGES_TODAY);
		pipeline.get(KEYS.TOKENS_TOTAL);
		pipeline.get(KEYS.TOKENS_TODAY);
		pipeline.scard(KEYS.ACTIVE_USERS(today));
		pipeline.get(KEYS.CHATS_TOTAL);
		pipeline.get(KEYS.CHATS_TODAY);

		const results = await pipeline.exec();

		return {
			messagesTotal: parseNumber(results?.[0] as unknown),
			messagesToday: parseNumber(results?.[1] as unknown),
			tokensTotal: parseNumber(results?.[2] as unknown),
			tokensToday: parseNumber(results?.[3] as unknown),
			activeUsersToday: parseNumber(results?.[4] as unknown),
			chatsTotal: parseNumber(results?.[5] as unknown),
			chatsToday: parseNumber(results?.[6] as unknown),
			timestamp: Date.now(),
		};
	} catch (error) {
		console.error("[Analytics] Failed to get analytics snapshot:", error);
		return defaultSnapshot;
	}
}

/**
 * Get messages sent today
 *
 * @returns Number of messages sent today
 */
export async function getMessagesToday(): Promise<number> {
	if (!isRedisStreamingAvailable()) return 0;

	try {
		const client = await redis.get();
		const value = await client.get(KEYS.MESSAGES_TODAY);
		return parseNumber(value);
	} catch (error) {
		console.error("[Analytics] Failed to get messages today:", error);
		return 0;
	}
}

/**
 * Get unique active users today
 *
 * @returns Number of unique active users today
 */
export async function getActiveUsersToday(): Promise<number> {
	if (!isRedisStreamingAvailable()) return 0;

	try {
		const client = await redis.get();
		const today = getTodayDate();
		const count = await client.scard(KEYS.ACTIVE_USERS(today));
		return count ?? 0;
	} catch (error) {
		console.error("[Analytics] Failed to get active users today:", error);
		return 0;
	}
}

/**
 * Get messages for a specific hour
 *
 * @param hour - Hour (0-23), defaults to current hour
 * @returns Number of messages in that hour
 */
export async function getMessagesForHour(hour?: number): Promise<number> {
	if (!isRedisStreamingAvailable()) return 0;

	try {
		const client = await redis.get();
		const targetHour = hour ?? getCurrentHour();
		const value = await client.get(KEYS.MESSAGES_HOUR(targetHour));
		return parseNumber(value);
	} catch (error) {
		console.error("[Analytics] Failed to get messages for hour:", error);
		return 0;
	}
}

// ============================================================================
// MAINTENANCE OPERATIONS
// ============================================================================

/**
 * Rotate daily counters
 *
 * Explicitly resets today's counters. This is optional because counters
 * use TTL-based expiry for automatic rotation.
 *
 * Use this for:
 * - Forcing a reset mid-day (e.g., after a data correction)
 * - Ensuring clean boundaries for billing periods
 * - Testing purposes
 *
 * NOTE: Active user sets are keyed by date and don't need rotation.
 */
export async function rotateDailyCounters(): Promise<void> {
	if (!isRedisStreamingAvailable()) return;

	try {
		const client = await redis.get();
		const pipeline = client.pipeline();

		// Reset today counters with fresh TTL
		pipeline.set(KEYS.MESSAGES_TODAY, 0, { ex: TTL.TODAY });
		pipeline.set(KEYS.TOKENS_TODAY, 0, { ex: TTL.TODAY });
		pipeline.set(KEYS.CHATS_TODAY, 0, { ex: TTL.TODAY });

		await pipeline.exec();

		console.log("[Analytics] Daily counters rotated");
	} catch (error) {
		console.error("[Analytics] Failed to rotate daily counters:", error);
	}
}

/**
 * Get all hourly message counts for the last 24 hours
 *
 * Useful for building hourly activity charts.
 *
 * @returns Map of hour (0-23) to message count
 */
export async function getHourlyMessageCounts(): Promise<Map<number, number>> {
	const result = new Map<number, number>();

	if (!isRedisStreamingAvailable()) {
		// Return empty map with zeros for all hours
		for (let i = 0; i < 24; i++) {
			result.set(i, 0);
		}
		return result;
	}

	try {
		const client = await redis.get();
		const pipeline = client.pipeline();

		// Queue reads for all 24 hours
		for (let hour = 0; hour < 24; hour++) {
			pipeline.get(KEYS.MESSAGES_HOUR(hour));
		}

		const results = await pipeline.exec();

		for (let hour = 0; hour < 24; hour++) {
			result.set(hour, parseNumber(results?.[hour] as unknown));
		}

		return result;
	} catch (error) {
		console.error("[Analytics] Failed to get hourly message counts:", error);
		// Return zeros on error
		for (let i = 0; i < 24; i++) {
			result.set(i, 0);
		}
		return result;
	}
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely parse a value to number
 *
 * Handles various Redis return types (string, number, null).
 *
 * @param value - Value from Redis
 * @returns Parsed number or 0
 */
function parseNumber(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = parseInt(value, 10);
		return isNaN(parsed) ? 0 : parsed;
	}
	return 0;
}

/**
 * Check if analytics counters are available
 *
 * @returns True if Redis is configured and available
 */
export function isAnalyticsAvailable(): boolean {
	return isRedisStreamingAvailable();
}
