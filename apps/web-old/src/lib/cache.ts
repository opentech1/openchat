/**
 * Unified Redis Cache Utility Layer for OpenChat
 *
 * This module provides a consistent caching interface built on top of the
 * existing Redis client. It supports typed cache operations with fail-open
 * error handling by default.
 *
 * ARCHITECTURE:
 * - Uses the same lazy-loaded Redis client from ./redis.ts
 * - Fail-open by default (returns null on errors instead of throwing)
 * - Consistent key prefixing for namespace isolation
 * - TTL-based expiration for all cached data
 *
 * USAGE:
 * ```typescript
 * // Using typed helpers
 * await userCache.set("user123", { _id: "123", externalId: "user123", cachedAt: Date.now() });
 * const user = await userCache.get("user123");
 *
 * // Using generic operations
 * await cacheSet("custom:key", { data: "value" }, { ttlSeconds: 300 });
 * const data = await cacheGet<{ data: string }>("custom:key");
 * ```
 *
 * @see redis.ts for the underlying Redis client implementation
 * @see rate-limit-redis.ts for rate limiting
 */

import { redis, isRedisStreamingAvailable } from "./redis";

// ============================================================================
// Key Prefixes
// ============================================================================

/**
 * Consistent key prefixes for cache namespacing.
 * All cache keys should use these prefixes to avoid collisions.
 */
// Maximum TTL to prevent accidental cache pollution (7 days)
const MAX_TTL_SECONDS = 604800;

export const CACHE_PREFIX = {
	/** User profile data cache */
	user: "cache:user:",
	/** Chat list cache per user */
	chats: "cache:chats:",
	/** Message cache per chat */
	messages: "cache:messages:",
	/** Model/provider data cache */
	models: "cache:models:",
	/** Context/system prompt cache */
	context: "cache:context:",
	/** Real-time presence tracking */
	presence: "presence:",
	/** Application statistics */
	stats: "stats:",
	/** Background job tracking */
	jobs: "jobs:",
} as const;

export type CachePrefixKey = keyof typeof CACHE_PREFIX;

// Legacy prefixes for backwards compatibility
const USER_CACHE_PREFIX = "user:profile:";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for cache operations
 */
export interface CacheOptions {
	/**
	 * Time-to-live in seconds. If not provided, no expiration is set.
	 */
	ttlSeconds?: number;
	/**
	 * If true (default), return null on Redis errors instead of throwing.
	 * Set to false for critical operations that must fail loudly.
	 */
	failOpen?: boolean;
}

/**
 * Generic cache interface
 * Note: set returns Promise<boolean> to indicate success/failure in fail-open mode
 */
export interface CacheOperations<T> {
	get(key: string): Promise<T | null>;
	set(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
	delete(key: string): Promise<boolean>;
}

/**
 * Cached user profile data
 */
export interface UserCacheData {
	_id: string;
	externalId: string;
	email?: string;
	name?: string;
	avatarUrl?: string;
	banned?: boolean;
	fileUploadCount?: number;
	/** Timestamp when this data was cached */
	cachedAt: number;
}

/**
 * Legacy cached user profile structure (backwards compatible)
 * @deprecated Use UserCacheData instead
 */
export interface CachedUserProfile {
	_id: string;
	externalId: string;
	email?: string;
	name?: string;
	avatarUrl?: string;
	cachedAt: number;
}

/**
 * Cached chat list data
 */
export interface ChatListCacheData {
	chats: Array<{
		id: string;
		title: string;
		updatedAt: string;
		lastMessageAt?: string;
		status?: string;
	}>;
	nextCursor?: string;
	/** Timestamp when this data was cached */
	cachedAt: number;
}

/**
 * Cached messages data
 */
export interface MessagesCacheData {
	messages: Array<{
		_id: string;
		role: string;
		content: string;
		reasoning?: string;
		status?: string;
		streamId?: string;
		createdAt: number;
	}>;
	/** Timestamp when this data was cached */
	cachedAt: number;
}

/**
 * OpenRouter model option structure
 * Matches the transformed model format from the API route
 */
export interface CachedModelOption {
	value: string;
	label: string;
	description?: string;
	context?: number | null;
	pricing?: {
		prompt: number | null;
		completion: number | null;
	};
	popular?: boolean;
	free?: boolean;
	capabilities?: {
		reasoning?: boolean;
		image?: boolean;
		audio?: boolean;
		video?: boolean;
		mandatoryReasoning?: boolean;
	};
}

/**
 * Cached models data structure
 */
export interface CachedModelsData {
	models: CachedModelOption[];
	cachedAt: number;
}

/**
 * Generic cached model data (simplified)
 */
export interface ModelsCacheData {
	models: Array<{
		id: string;
		name: string;
		provider: string;
		contextLength?: number;
		pricing?: {
			prompt: number;
			completion: number;
		};
	}>;
	/** Timestamp when this data was cached */
	cachedAt: number;
}

/**
 * Cached context/system prompt data
 */
export interface ContextCacheData {
	systemPrompt?: string;
	contextFiles?: Array<{
		id: string;
		name: string;
		content: string;
	}>;
	/** Timestamp when this data was cached */
	cachedAt: number;
}

/**
 * Cached chat list response structure
 * Matches the serialized chat format from the API route
 */
export interface CachedChatsResponse {
	chats: Array<{
		id: string;
		title: string | null;
		updatedAt: string;
		lastMessageAt: string | null;
		status?: string | null;
	}>;
	nextCursor: string | null;
}

// ============================================================================
// Core Cache Operations
// ============================================================================

/**
 * Check if Redis cache is available and configured
 *
 * @returns True if Redis credentials are configured
 */
export function isRedisCacheAvailable(): boolean {
	return redis.isConfigured();
}

/**
 * Alias for isRedisCacheAvailable for consistency with other modules
 */
export function isCacheAvailable(): boolean {
	return isRedisStreamingAvailable();
}

/**
 * Get a value from cache
 *
 * @param key - The cache key
 * @param options - Cache options
 * @returns The cached value or null if not found/error
 *
 * @example
 * ```typescript
 * const user = await cacheGet<UserCacheData>("cache:user:123");
 * ```
 */
export async function cacheGet<T>(
	key: string,
	options: CacheOptions = {},
): Promise<T | null> {
	const { failOpen = true } = options;

	if (!isRedisStreamingAvailable()) {
		return null;
	}

	try {
		const client = await redis.get();
		const data = await client.get<string>(key);

		if (data === null || data === undefined) {
			return null;
		}

		// Handle case where data is already parsed (Upstash auto-parses JSON)
		if (typeof data === "object") {
			return data as T;
		}

		try {
			const parsed = JSON.parse(data);
			// Type safety: validate we got an object (most cached data should be objects)
			if (parsed === null || typeof parsed !== "object") {
				console.warn("[cache] Invalid cached data type for key:", key, "- expected object, got:", typeof parsed);
				return null;
			}
			return parsed as T;
		} catch (parseError) {
			// Data might not be JSON - log and return null for type safety
			console.error("[cache] Failed to parse cached data for key:", key, parseError);
			return null;
		}
	} catch (error) {
		console.error("[cache] Error getting key:", key, error);
		if (failOpen) {
			return null;
		}
		throw error;
	}
}

/**
 * Set a value in cache
 *
 * @param key - The cache key
 * @param value - The value to cache (will be JSON serialized)
 * @param options - Cache options including TTL
 * @returns True if successful, false on error
 *
 * @example
 * ```typescript
 * await cacheSet("cache:user:123", userData, { ttlSeconds: 3600 });
 * ```
 */
export async function cacheSet<T>(
	key: string,
	value: T,
	options: CacheOptions = {},
): Promise<boolean> {
	const { ttlSeconds, failOpen = true } = options;

	if (!isRedisStreamingAvailable()) {
		return false;
	}

	try {
		const client = await redis.get();
		const serialized = JSON.stringify(value);

		// Validate and clamp TTL to prevent cache pollution
		let validatedTtl: number | undefined;
		if (ttlSeconds !== undefined && ttlSeconds > 0) {
			validatedTtl = Math.min(Math.max(1, ttlSeconds), MAX_TTL_SECONDS);
			if (ttlSeconds > MAX_TTL_SECONDS) {
				console.warn(`[cache] TTL ${ttlSeconds}s exceeds max (${MAX_TTL_SECONDS}s), clamped for key:`, key);
			}
		}

		if (validatedTtl !== undefined) {
			await client.set(key, serialized, { ex: validatedTtl });
		} else {
			await client.set(key, serialized);
		}

		return true;
	} catch (error) {
		console.error("[cache] Error setting key:", key, error);
		if (failOpen) {
			return false;
		}
		throw error;
	}
}

/**
 * Delete a value from cache
 *
 * @param key - The cache key to delete
 * @returns True if deleted, false on error or key not found
 *
 * @example
 * ```typescript
 * await cacheDelete("cache:user:123");
 * ```
 */
export async function cacheDelete(key: string): Promise<boolean> {
	if (!isRedisStreamingAvailable()) {
		return false;
	}

	try {
		const client = await redis.get();
		const result = await client.del(key);
		return result > 0;
	} catch (error) {
		console.error("[cache] Error deleting key:", key, error);
		return false;
	}
}

/**
 * Check if a key exists in cache
 *
 * @param key - The cache key to check
 * @returns True if key exists, false otherwise
 *
 * @example
 * ```typescript
 * if (await cacheExists("cache:user:123")) {
 *   // Key exists
 * }
 * ```
 */
export async function cacheExists(key: string): Promise<boolean> {
	if (!isRedisStreamingAvailable()) {
		return false;
	}

	try {
		const client = await redis.get();
		const result = await client.exists(key);
		return result > 0;
	} catch (error) {
		console.error("[cache] Error checking existence:", key, error);
		return false;
	}
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get multiple values from cache
 *
 * @param keys - Array of cache keys
 * @returns Array of values (null for missing/error keys)
 *
 * @example
 * ```typescript
 * const users = await cacheGetMany<UserCacheData>(["cache:user:1", "cache:user:2"]);
 * ```
 */
export async function cacheGetMany<T>(keys: string[]): Promise<(T | null)[]> {
	if (!isRedisStreamingAvailable() || keys.length === 0) {
		return keys.map(() => null);
	}

	try {
		const client = await redis.get();
		const results = await client.mget<(string | null)[]>(...keys);

		return results.map((data, index) => {
			if (data === null || data === undefined) {
				return null;
			}

			// Handle case where data is already parsed
			if (typeof data === "object") {
				return data as T;
			}

			try {
				const parsed = JSON.parse(data);
				// Type safety: validate we got an object
				if (parsed === null || typeof parsed !== "object") {
					console.warn("[cache] Invalid cached data type for key:", keys[index], "- expected object, got:", typeof parsed);
					return null;
				}
				return parsed as T;
			} catch (parseError) {
				// Data might not be JSON - log and return null for type safety
				console.error("[cache] Failed to parse cached data for key:", keys[index], parseError);
				return null;
			}
		});
	} catch (error) {
		console.error("[cache] Error getting multiple keys:", keys, error);
		return keys.map(() => null);
	}
}

/**
 * Set multiple values in cache
 *
 * @param entries - Array of key-value pairs with optional TTL
 * @returns True if all successful, false if any failed
 *
 * @example
 * ```typescript
 * await cacheSetMany([
 *   { key: "cache:user:1", value: user1, ttlSeconds: 3600 },
 *   { key: "cache:user:2", value: user2, ttlSeconds: 3600 },
 * ]);
 * ```
 */
export async function cacheSetMany<T>(
	entries: Array<{ key: string; value: T; ttlSeconds?: number }>,
): Promise<boolean> {
	if (!isRedisStreamingAvailable() || entries.length === 0) {
		return false;
	}

	try {
		const client = await redis.get();
		const pipeline = client.pipeline();

		for (const entry of entries) {
			const serialized = JSON.stringify(entry.value);
			if (entry.ttlSeconds !== undefined && entry.ttlSeconds > 0) {
				pipeline.set(entry.key, serialized, { ex: entry.ttlSeconds });
			} else {
				pipeline.set(entry.key, serialized);
			}
		}

		await pipeline.exec();
		return true;
	} catch (error) {
		console.error("[cache] Error setting multiple keys:", error);
		return false;
	}
}

/**
 * Delete multiple values from cache
 *
 * @param keys - Array of cache keys to delete
 * @returns Number of keys deleted
 *
 * @example
 * ```typescript
 * const deleted = await cacheDeleteMany(["cache:user:1", "cache:user:2"]);
 * ```
 */
export async function cacheDeleteMany(keys: string[]): Promise<number> {
	if (!isRedisStreamingAvailable() || keys.length === 0) {
		return 0;
	}

	try {
		const client = await redis.get();
		return await client.del(...keys);
	} catch (error) {
		console.error("[cache] Error deleting multiple keys:", error);
		return 0;
	}
}

/**
 * Invalidate all keys matching a pattern
 *
 * WARNING: SCAN operations can be slow on large datasets.
 * Use sparingly and prefer specific key deletion when possible.
 *
 * @param pattern - Redis pattern (e.g., "cache:user:*")
 * @returns Number of keys deleted
 *
 * @example
 * ```typescript
 * // Invalidate all user caches
 * await cacheInvalidatePattern("cache:user:*");
 *
 * // Invalidate all caches for a specific user's chats
 * await cacheInvalidatePattern("cache:chats:user123:*");
 * ```
 */
export async function cacheInvalidatePattern(pattern: string): Promise<number> {
	if (!isRedisStreamingAvailable()) {
		return 0;
	}

	try {
		const client = await redis.get();

		// Use KEYS for Upstash Redis (more reliable in REST API)
		const keys = await client.keys(pattern);

		if (keys.length === 0) {
			return 0;
		}

		// Delete in batches to avoid hitting request size limits
		const batchSize = 100;
		let totalDeleted = 0;

		for (let i = 0; i < keys.length; i += batchSize) {
			const batch = keys.slice(i, i + batchSize);
			const deleted = await client.del(...batch);
			totalDeleted += deleted;
		}

		return totalDeleted;
	} catch (error) {
		console.error("[cache] Error invalidating pattern:", pattern, error);
		return 0;
	}
}

// ============================================================================
// TTL Operations
// ============================================================================

/**
 * Get the remaining TTL for a key
 *
 * @param key - The cache key
 * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist, null on error
 *
 * @example
 * ```typescript
 * const ttl = await cacheGetTTL("cache:user:123");
 * if (ttl !== null && ttl < 60) {
 *   // Refresh cache soon
 * }
 * ```
 */
export async function cacheGetTTL(key: string): Promise<number | null> {
	if (!isRedisStreamingAvailable()) {
		return null;
	}

	try {
		const client = await redis.get();
		return await client.ttl(key);
	} catch (error) {
		console.error("[cache] Error getting TTL:", key, error);
		return null;
	}
}

/**
 * Set or update the TTL for a key
 *
 * @param key - The cache key
 * @param ttlSeconds - New TTL in seconds
 * @returns True if successful, false if key doesn't exist or error
 *
 * @example
 * ```typescript
 * await cacheSetTTL("cache:user:123", 3600); // Extend to 1 hour
 * ```
 */
export async function cacheSetTTL(
	key: string,
	ttlSeconds: number,
): Promise<boolean> {
	if (!isRedisStreamingAvailable()) {
		return false;
	}

	try {
		const client = await redis.get();
		const result = await client.expire(key, ttlSeconds);
		return result === 1;
	} catch (error) {
		console.error("[cache] Error setting TTL:", key, error);
		return false;
	}
}

// ============================================================================
// Typed Cache Helpers
// ============================================================================

/**
 * User profile cache operations
 *
 * @example
 * ```typescript
 * // Cache user data
 * await userCache.set("user_abc123", {
 *   _id: "123",
 *   externalId: "user_abc123",
 *   email: "user@example.com",
 *   name: "John Doe",
 *   cachedAt: Date.now(),
 * });
 *
 * // Get cached user
 * const user = await userCache.get("user_abc123");
 *
 * // Invalidate on update
 * await userCache.invalidate("user_abc123");
 * ```
 */
export const userCache = {
	/**
	 * Generate cache key for user
	 */
	key: (externalId: string): string => `${CACHE_PREFIX.user}${externalId}`,

	/**
	 * Get cached user data
	 */
	get: async (externalId: string): Promise<UserCacheData | null> => {
		// Try new key first
		const newKeyResult = await cacheGet<UserCacheData>(userCache.key(externalId));
		if (newKeyResult) return newKeyResult;

		// Try legacy key for backwards compatibility
		if (!isRedisCacheAvailable()) {
			return null;
		}

		try {
			const client = await redis.get();
			const legacyKey = `${USER_CACHE_PREFIX}${externalId}`;
			const data = await client.get<string>(legacyKey);

			if (!data) {
				return null;
			}

			try {
				const parsed = typeof data === "string" ? JSON.parse(data) : data;
				return parsed as UserCacheData;
			} catch {
				console.warn(`[cache] Failed to parse cached user profile for ${externalId}`);
				return null;
			}
		} catch (error) {
			console.error("[cache] Redis get failed:", error);
			return null;
		}
	},

	/**
	 * Cache user data
	 * @param ttlSeconds - Default 60 seconds
	 */
	set: async (
		externalId: string,
		data: UserCacheData,
		ttlSeconds: number = 60,
	): Promise<boolean> => {
		// Set both new and legacy keys for backwards compatibility during migration
		// TODO: Remove legacy key support after migration confirmed complete (added: Dec 2025)
		const newKeyResult = await cacheSet(userCache.key(externalId), data, { ttlSeconds });

		// Also set legacy key
		if (isRedisCacheAvailable()) {
			try {
				const client = await redis.get();
				const legacyKey = `${USER_CACHE_PREFIX}${externalId}`;
				const profileWithTimestamp = {
					...data,
					cachedAt: Date.now(),
				};
				await client.set(legacyKey, JSON.stringify(profileWithTimestamp), { ex: ttlSeconds });
			} catch (error) {
				console.error("[cache] Redis set failed (legacy key):", error);
			}
		}

		return newKeyResult;
	},

	/**
	 * Invalidate cached user data
	 */
	invalidate: async (externalId: string): Promise<boolean> => {
		// Delete both new and legacy keys
		const newKeyResult = await cacheDelete(userCache.key(externalId));

		// Also delete legacy key
		if (isRedisCacheAvailable()) {
			try {
				const client = await redis.get();
				const legacyKey = `${USER_CACHE_PREFIX}${externalId}`;
				await client.del(legacyKey);
			} catch (error) {
				console.error("[cache] Redis delete failed (legacy key):", error);
			}
		}

		return newKeyResult;
	},

	/**
	 * Check if user is cached
	 */
	exists: async (externalId: string): Promise<boolean> => {
		return cacheExists(userCache.key(externalId));
	},

	/**
	 * Delete cached user profile (legacy interface for backwards compatibility)
	 * @deprecated Use userCache.invalidate instead
	 */
	delete: async (externalId: string): Promise<void> => {
		await userCache.invalidate(externalId);
	},
};

/**
 * Chat list cache operations
 *
 * @example
 * ```typescript
 * // Cache chat list for user (paginated)
 * const key = chatsCache.key("user123", 20);
 * await chatsCache.set(key, {
 *   chats: [...],
 *   nextCursor: null,
 * });
 *
 * // Get cached chat list
 * const chatList = await chatsCache.get(key);
 *
 * // Invalidate when chat is created/deleted
 * await chatsCache.invalidateForUser("user123");
 * ```
 */
export const chatsCache = {
	/**
	 * Generate cache key for user's chat list
	 *
	 * @param userId - User's Convex ID
	 * @param limit - Page size
	 * @param cursor - Pagination cursor (or undefined for initial page)
	 * @returns Cache key in format: cache:chats:{userId}:{limit}:{cursor|'initial'}
	 */
	key: (userId: string, limit: number, cursor?: string): string => {
		const cursorPart = cursor || "initial";
		return `${CACHE_PREFIX.chats}${userId}:${limit}:${cursorPart}`;
	},

	/**
	 * Get cached chat list
	 */
	get: async (key: string): Promise<CachedChatsResponse | null> => {
		if (!isRedisCacheAvailable()) {
			return null;
		}

		try {
			const client = await redis.get();
			const data = await client.get<string>(key);

			if (!data) {
				return null;
			}

			try {
				const parsed = typeof data === "string" ? JSON.parse(data) : data;
				return parsed as CachedChatsResponse;
			} catch {
				console.warn(`[cache] Failed to parse cached chats for key ${key}`);
				await client.del(key);
				return null;
			}
		} catch (error) {
			console.error("[cache] Redis chats get failed:", error);
			return null;
		}
	},

	/**
	 * Cache chat list
	 * @param ttlSeconds - Default 120 seconds (2 minutes)
	 */
	set: async (key: string, data: CachedChatsResponse, ttlSeconds: number = 120): Promise<void> => {
		if (!isRedisCacheAvailable()) {
			return;
		}

		try {
			const client = await redis.get();
			await client.set(key, JSON.stringify(data), { ex: ttlSeconds });
		} catch (error) {
			console.error("[cache] Redis chats set failed:", error);
		}
	},

	/**
	 * Invalidate all chat list caches for a user
	 *
	 * @param userId - User's Convex ID
	 * @returns Number of keys deleted
	 */
	invalidateForUser: async (userId: string): Promise<number> => {
		if (!isRedisCacheAvailable()) {
			return 0;
		}

		try {
			const client = await redis.get();
			const pattern = `${CACHE_PREFIX.chats}${userId}:*`;
			const keys = await client.keys(pattern);

			if (keys.length === 0) {
				return 0;
			}

			const batchSize = 100;
			let deleted = 0;

			for (let i = 0; i < keys.length; i += batchSize) {
				const batch = keys.slice(i, i + batchSize);
				await client.del(...batch);
				deleted += batch.length;
			}

			console.log(`[cache] Invalidated ${deleted} chat cache entries for user ${userId}`);
			return deleted;
		} catch (error) {
			console.error("[cache] Redis chats invalidation failed:", error);
			return 0;
		}
	},

	/**
	 * Invalidate cached chat list (alias for compatibility)
	 */
	invalidate: async (key: string): Promise<boolean> => {
		return cacheDelete(key);
	},

	/**
	 * Check if chat list is cached
	 */
	exists: async (key: string): Promise<boolean> => {
		return cacheExists(key);
	},
};

/**
 * Messages cache operations
 *
 * @example
 * ```typescript
 * // Cache messages for a chat
 * await messagesCache.set("chat123", {
 *   messages: [...],
 *   cachedAt: Date.now(),
 * });
 *
 * // Get cached messages
 * const messages = await messagesCache.get("chat123");
 * ```
 */
export const messagesCache = {
	/**
	 * Generate cache key for chat messages
	 */
	key: (chatId: string): string => `${CACHE_PREFIX.messages}${chatId}`,

	/**
	 * Get cached messages
	 */
	get: async (chatId: string): Promise<MessagesCacheData | null> => {
		return cacheGet<MessagesCacheData>(messagesCache.key(chatId));
	},

	/**
	 * Cache messages
	 * @param ttlSeconds - Default 60 seconds
	 */
	set: async (
		chatId: string,
		data: MessagesCacheData,
		ttlSeconds: number = 60,
	): Promise<boolean> => {
		return cacheSet(messagesCache.key(chatId), data, { ttlSeconds });
	},

	/**
	 * Invalidate cached messages
	 */
	invalidate: async (chatId: string): Promise<boolean> => {
		return cacheDelete(messagesCache.key(chatId));
	},

	/**
	 * Check if messages are cached
	 */
	exists: async (chatId: string): Promise<boolean> => {
		return cacheExists(messagesCache.key(chatId));
	},
};

/**
 * Models cache operations
 *
 * @example
 * ```typescript
 * // Cache available models
 * await modelsCache.set("openrouter", {
 *   models: [...],
 *   cachedAt: Date.now(),
 * });
 * ```
 */
export const modelsCache: CacheOperations<CachedModelsData> & {
	key: (provider: string) => string;
	invalidateAll: () => Promise<number>;
} = {
	/**
	 * Generate cache key for models by provider
	 */
	key: (provider: string): string => `${CACHE_PREFIX.models}${provider}`,

	/**
	 * Get cached models
	 */
	get: async (apiKeyPrefix: string): Promise<CachedModelsData | null> => {
		if (!isRedisCacheAvailable()) {
			return null;
		}

		try {
			const client = await redis.get();
			const key = `${CACHE_PREFIX.models}${apiKeyPrefix}`;
			const data = await client.get<string>(key);

			if (!data) {
				return null;
			}

			try {
				const parsed = typeof data === "string" ? JSON.parse(data) : data;
				return parsed as CachedModelsData;
			} catch {
				console.warn(`[cache] Failed to parse cached models for key prefix ${apiKeyPrefix}`);
				await client.del(key);
				return null;
			}
		} catch (error) {
			console.error("[cache] Redis models get failed:", error);
			return null;
		}
	},

	/**
	 * Cache models
	 * @param ttlSeconds - Default 1800 seconds (30 minutes)
	 * @returns True if successful, false on error
	 */
	set: async (apiKeyPrefix: string, data: CachedModelsData, ttlSeconds: number = 1800): Promise<boolean> => {
		if (!isRedisCacheAvailable()) {
			return false;
		}

		try {
			const client = await redis.get();
			const key = `${CACHE_PREFIX.models}${apiKeyPrefix}`;
			await client.set(key, JSON.stringify(data), { ex: ttlSeconds });
			return true;
		} catch (error) {
			console.error("[cache] Redis models set failed:", error);
			return false;
		}
	},

	/**
	 * Delete cached models (for invalidation)
	 * @returns True if deleted, false on error
	 */
	delete: async (apiKeyPrefix: string): Promise<boolean> => {
		if (!isRedisCacheAvailable()) {
			return false;
		}

		try {
			const client = await redis.get();
			const key = `${CACHE_PREFIX.models}${apiKeyPrefix}`;
			const result = await client.del(key);
			return result > 0;
		} catch (error) {
			console.error("[cache] Redis models delete failed:", error);
			return false;
		}
	},

	/**
	 * Invalidate all model caches
	 */
	invalidateAll: async (): Promise<number> => {
		return cacheInvalidatePattern(`${CACHE_PREFIX.models}*`);
	},
};

/**
 * Context/system prompt cache operations
 *
 * @example
 * ```typescript
 * // Cache context for a chat
 * await contextCache.set("chat123", {
 *   systemPrompt: "You are a helpful assistant...",
 *   cachedAt: Date.now(),
 * });
 * ```
 */
export const contextCache = {
	/**
	 * Generate cache key for chat context
	 */
	key: (chatId: string): string => `${CACHE_PREFIX.context}${chatId}`,

	/**
	 * Get cached context
	 */
	get: async (chatId: string): Promise<ContextCacheData | null> => {
		return cacheGet<ContextCacheData>(contextCache.key(chatId));
	},

	/**
	 * Cache context
	 * @param ttlSeconds - Default 300 seconds (5 minutes)
	 */
	set: async (
		chatId: string,
		data: ContextCacheData,
		ttlSeconds: number = 300,
	): Promise<boolean> => {
		return cacheSet(contextCache.key(chatId), data, { ttlSeconds });
	},

	/**
	 * Invalidate cached context
	 */
	invalidate: async (chatId: string): Promise<boolean> => {
		return cacheDelete(contextCache.key(chatId));
	},

	/**
	 * Check if context is cached
	 */
	exists: async (chatId: string): Promise<boolean> => {
		return cacheExists(contextCache.key(chatId));
	},
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get or set pattern (cache-aside)
 *
 * Attempts to get from cache first. If not found, calls the factory function
 * to generate the value, caches it, and returns it.
 *
 * @param key - Cache key
 * @param factory - Async function to generate value if not cached
 * @param options - Cache options including TTL
 * @returns The cached or generated value
 *
 * @example
 * ```typescript
 * const user = await cacheGetOrSet(
 *   userCache.key("user123"),
 *   async () => {
 *     // Fetch from database
 *     const userData = await db.getUser("user123");
 *     return { ...userData, cachedAt: Date.now() };
 *   },
 *   { ttlSeconds: 60 }
 * );
 * ```
 */
export async function cacheGetOrSet<T>(
	key: string,
	factory: () => Promise<T>,
	options: CacheOptions = {},
): Promise<T> {
	// Try to get from cache first
	const cached = await cacheGet<T>(key, options);
	if (cached !== null) {
		return cached;
	}

	// Generate value using factory
	const value = await factory();

	// Cache the value (don't await to avoid blocking)
	cacheSet(key, value, options).catch((error) => {
		console.error("[cache] Error in getOrSet cache write:", key, error);
	});

	return value;
}

/**
 * Refresh a cached value in the background
 *
 * Gets the current cached value, calls the factory to generate a new value,
 * and updates the cache. Returns the current cached value immediately.
 *
 * @param key - Cache key
 * @param factory - Async function to generate new value
 * @param options - Cache options including TTL
 * @returns The current cached value (may be stale) or null
 *
 * @example
 * ```typescript
 * // Trigger background refresh
 * const currentUser = await cacheRefreshInBackground(
 *   userCache.key("user123"),
 *   async () => {
 *     const userData = await db.getUser("user123");
 *     return { ...userData, cachedAt: Date.now() };
 *   },
 *   { ttlSeconds: 60 }
 * );
 * ```
 */
export async function cacheRefreshInBackground<T>(
	key: string,
	factory: () => Promise<T>,
	options: CacheOptions = {},
): Promise<T | null> {
	// Get current cached value
	const cached = await cacheGet<T>(key, options);

	// Trigger background refresh
	factory()
		.then((value) => cacheSet(key, value, options))
		.catch((error) => {
			console.error("[cache] Error in background refresh:", key, error);
		});

	return cached;
}

// ============================================================================
// Legacy Exports (Backwards Compatibility)
// ============================================================================

/**
 * Invalidate user cache by external ID
 *
 * Call this when user data changes (profile update, etc.)
 *
 * @param externalId - User's external ID (from auth provider)
 * @deprecated Use userCache.invalidate instead
 */
export async function invalidateUserCache(externalId: string): Promise<void> {
	await userCache.invalidate(externalId);
	console.log(`[cache] Invalidated user cache for ${externalId}`);
}
