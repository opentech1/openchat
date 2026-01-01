/**
 * Messages Cache Layer for OpenChat
 *
 * Provides Redis-based caching for chat messages to enable instant chat opening.
 * Uses a short TTL (60 seconds) since chat messages update frequently during
 * active conversations.
 *
 * ARCHITECTURE:
 * - Cache key format: cache:messages:{chatId}
 * - TTL: 60 seconds (configurable)
 * - Fail-open by default (returns null on errors)
 * - Excludes streaming messages from cache
 *
 * INTEGRATION POINTS:
 * - Check cache on initial chat load (before Convex query)
 * - Update cache when messages are fetched from Convex
 * - Invalidate cache when new messages are added
 * - Invalidate cache when streaming completes
 *
 * USAGE:
 * ```typescript
 * // Get cached messages
 * const cached = await getCachedMessages(chatId);
 * if (cached) {
 *   // Use cached messages for instant display
 *   renderMessages(cached.messages);
 * }
 *
 * // Cache messages after fetch
 * await setCachedMessages(chatId, messages);
 *
 * // Invalidate on new message
 * await invalidateMessagesCache(chatId);
 * ```
 *
 * @see cache.ts for underlying Redis operations
 * @see convex-server.ts for server-side message fetching
 */

import {
	messagesCache,
	isRedisCacheAvailable,
	type MessagesCacheData,
} from "./cache";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default TTL for messages cache in seconds.
 * Short TTL (60 seconds) ensures freshness during active conversations.
 */
export const MESSAGES_CACHE_TTL_SECONDS = 60;

// ============================================================================
// Types
// ============================================================================

/**
 * Individual cached message structure.
 * Matches the message format returned by api.messages.list but with
 * only the fields needed for UI rendering.
 */
export interface CachedMessage {
	/** Convex message ID */
	_id: string;
	/** Optional client-generated message ID for optimistic updates */
	clientMessageId?: string;
	/** Message role: "user" or "assistant" */
	role: "user" | "assistant";
	/** Message content text */
	content: string;
	/** Reasoning/thinking content (for reasoning models) */
	reasoning?: string;
	/** Time spent thinking in milliseconds (for reasoning models) */
	thinkingTimeMs?: number;
	/** Message status: "streaming" or "completed" */
	status?: "streaming" | "completed";
	/** Stream ID for reconnection to active streams */
	streamId?: string;
	/** File attachments */
	attachments?: Array<{
		storageId: string;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
		url?: string;
	}>;
	/** Unix timestamp when message was created */
	createdAt: number;
	/** Unix timestamp when message was soft-deleted (optional) */
	deletedAt?: number;
}

/**
 * Result from getting cached messages.
 * Includes metadata about when the cache was populated.
 */
export interface MessagesCacheResult {
	/** Array of cached messages */
	messages: CachedMessage[];
	/** Unix timestamp when these messages were cached */
	cachedAt: number;
}

/**
 * Raw message format from Convex (for type conversion).
 * This matches the return type of api.messages.list.
 */
export interface ConvexMessageDoc {
	_id: string;
	clientMessageId?: string;
	role: string;
	content: string;
	reasoning?: string;
	thinkingTimeMs?: number;
	status?: string;
	streamId?: string;
	attachments?: Array<{
		storageId: string;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
		url?: string;
	}>;
	createdAt: number;
	deletedAt?: number;
}

// ============================================================================
// Core Cache Functions
// ============================================================================

/**
 * Check if Redis messages cache is available.
 *
 * @returns True if Redis is configured and available
 */
export function isMessagesCacheAvailable(): boolean {
	return isRedisCacheAvailable();
}

/**
 * Get cached messages for a chat.
 *
 * @param chatId - The Convex chat ID
 * @returns Cached messages result or null if not cached/unavailable
 *
 * @example
 * ```typescript
 * const cached = await getCachedMessages(chatId);
 * if (cached) {
 *   console.log(`Found ${cached.messages.length} cached messages`);
 *   console.log(`Cached at: ${new Date(cached.cachedAt)}`);
 * }
 * ```
 */
export async function getCachedMessages(
	chatId: string
): Promise<MessagesCacheResult | null> {
	if (!isRedisCacheAvailable()) {
		return null;
	}

	try {
		const cached = await messagesCache.get(chatId);

		if (!cached) {
			return null;
		}

		// Validate cached data structure
		if (
			!cached.messages ||
			!Array.isArray(cached.messages) ||
			typeof cached.cachedAt !== "number"
		) {
			console.warn(
				`[messages-cache] Invalid cache data structure for chat ${chatId}`
			);
			await messagesCache.invalidate(chatId);
			return null;
		}

		// Transform to proper typed result
		const result: MessagesCacheResult = {
			messages: cached.messages.map((msg) => ({
				_id: msg._id,
				clientMessageId: (msg as CachedMessage).clientMessageId,
				role: msg.role as "user" | "assistant",
				content: msg.content,
				reasoning: msg.reasoning,
				thinkingTimeMs: (msg as CachedMessage).thinkingTimeMs,
				status: msg.status as "streaming" | "completed" | undefined,
				streamId: msg.streamId,
				attachments: (msg as CachedMessage).attachments,
				createdAt: msg.createdAt,
				deletedAt: (msg as CachedMessage).deletedAt,
			})),
			cachedAt: cached.cachedAt,
		};

		return result;
	} catch (error) {
		console.error("[messages-cache] Error getting cached messages:", error);
		return null;
	}
}

/**
 * Cache messages for a chat.
 *
 * IMPORTANT: This function filters out streaming messages before caching.
 * Streaming messages are incomplete and should not be cached.
 *
 * @param chatId - The Convex chat ID
 * @param messages - Array of messages to cache
 * @param ttlSeconds - Optional TTL override (default: 60 seconds)
 *
 * @example
 * ```typescript
 * // After fetching messages from Convex
 * const messages = await client.query(api.messages.list, { chatId, userId });
 * await setCachedMessages(chatId, messages);
 * ```
 */
export async function setCachedMessages(
	chatId: string,
	messages: ConvexMessageDoc[],
	ttlSeconds: number = MESSAGES_CACHE_TTL_SECONDS
): Promise<void> {
	if (!isRedisCacheAvailable()) {
		return;
	}

	try {
		// IMPORTANT: Filter out streaming messages - they are incomplete
		// and should not be cached. Only cache completed messages.
		const completedMessages = messages.filter(
			(msg) => msg.status !== "streaming"
		);

		// Transform messages to cached format
		const cachedMessages: CachedMessage[] = completedMessages.map((msg) => ({
			_id: String(msg._id),
			clientMessageId: msg.clientMessageId,
			role: msg.role as "user" | "assistant",
			content: msg.content,
			reasoning: msg.reasoning,
			thinkingTimeMs: msg.thinkingTimeMs,
			status: msg.status as "streaming" | "completed" | undefined,
			streamId: msg.streamId,
			attachments: msg.attachments?.map((a) => ({
				storageId: String(a.storageId),
				filename: a.filename,
				contentType: a.contentType,
				size: a.size,
				uploadedAt: a.uploadedAt,
				url: a.url,
			})),
			createdAt: msg.createdAt,
			deletedAt: msg.deletedAt,
		}));

		const cacheData: MessagesCacheData = {
			messages: cachedMessages,
			cachedAt: Date.now(),
		};

		await messagesCache.set(chatId, cacheData, ttlSeconds);

		console.debug(
			`[messages-cache] Cached ${cachedMessages.length} messages for chat ${chatId} (TTL: ${ttlSeconds}s)`
		);
	} catch (error) {
		console.error("[messages-cache] Error setting cached messages:", error);
		// Fail-open: don't throw, just log the error
	}
}

/**
 * Invalidate cached messages for a chat.
 *
 * Call this when:
 * - A new message is added to the chat
 * - A message is deleted
 * - Streaming completes
 * - Any message content changes
 *
 * @param chatId - The Convex chat ID
 * @returns True if cache was invalidated, false on error
 *
 * @example
 * ```typescript
 * // After sending a new message
 * await sendMessage(chatId, content);
 * await invalidateMessagesCache(chatId);
 * ```
 */
export async function invalidateMessagesCache(chatId: string): Promise<boolean> {
	if (!isRedisCacheAvailable()) {
		return false;
	}

	try {
		const deleted = await messagesCache.invalidate(chatId);
		if (deleted) {
			console.debug(`[messages-cache] Invalidated cache for chat ${chatId}`);
		}
		return deleted;
	} catch (error) {
		console.error("[messages-cache] Error invalidating cache:", error);
		return false;
	}
}

/**
 * Invalidate cache when a new message is added.
 *
 * This is an alias for invalidateMessagesCache with a more descriptive name
 * for the use case of new message arrival.
 *
 * @param chatId - The Convex chat ID
 * @returns True if cache was invalidated, false on error
 *
 * @example
 * ```typescript
 * // In streaming completion handler
 * onStreamComplete: async () => {
 *   await invalidateMessagesCacheOnNewMessage(chatId);
 * }
 * ```
 */
export async function invalidateMessagesCacheOnNewMessage(
	chatId: string
): Promise<boolean> {
	return invalidateMessagesCache(chatId);
}

/**
 * Check if messages are cached for a chat.
 *
 * @param chatId - The Convex chat ID
 * @returns True if messages are cached, false otherwise
 */
export async function hasMessagesCache(chatId: string): Promise<boolean> {
	if (!isRedisCacheAvailable()) {
		return false;
	}

	try {
		return await messagesCache.exists(chatId);
	} catch (error) {
		console.error("[messages-cache] Error checking cache existence:", error);
		return false;
	}
}

// ============================================================================
// Cache-First Fetch Pattern
// ============================================================================

/**
 * Options for cache-first message fetching.
 */
export interface CacheFirstOptions {
	/** TTL for cache in seconds (default: 60) */
	ttlSeconds?: number;
	/** If true, skip cache and fetch fresh (default: false) */
	skipCache?: boolean;
	/** If true, refresh cache in background (default: false) */
	staleWhileRevalidate?: boolean;
}

/**
 * Result from cache-first fetch.
 */
export interface CacheFirstResult {
	/** Array of cached messages */
	messages: CachedMessage[];
	/** True if result came from cache */
	fromCache: boolean;
	/** Unix timestamp when data was cached (null if fresh) */
	cachedAt: number | null;
	/** True if background refresh was triggered */
	refreshing: boolean;
}

/**
 * Fetch messages with cache-first strategy.
 *
 * This function:
 * 1. Checks the cache first for instant display
 * 2. If cached and staleWhileRevalidate, returns cached and fetches fresh in background
 * 3. If not cached, fetches fresh and caches the result
 *
 * @param chatId - The Convex chat ID
 * @param fetchFresh - Async function to fetch fresh messages from Convex
 * @param options - Cache options
 * @returns Cache-first result with messages and metadata
 *
 * @example
 * ```typescript
 * const result = await fetchMessagesWithCache(
 *   chatId,
 *   () => convexClient.query(api.messages.list, { chatId, userId }),
 *   { staleWhileRevalidate: true }
 * );
 *
 * if (result.fromCache) {
 *   console.log("Showing cached messages instantly!");
 * }
 * ```
 */
export async function fetchMessagesWithCache(
	chatId: string,
	fetchFresh: () => Promise<ConvexMessageDoc[]>,
	options: CacheFirstOptions = {}
): Promise<CacheFirstResult> {
	const {
		ttlSeconds = MESSAGES_CACHE_TTL_SECONDS,
		skipCache = false,
		staleWhileRevalidate = false,
	} = options;

	// Check cache first (unless skipped)
	if (!skipCache) {
		const cached = await getCachedMessages(chatId);

		if (cached) {
			// Return cached immediately
			if (staleWhileRevalidate) {
				// Trigger background refresh (don't await)
				fetchFresh()
					.then((fresh) => setCachedMessages(chatId, fresh, ttlSeconds))
					.catch((error) =>
						console.error(
							"[messages-cache] Background refresh failed:",
							error
						)
					);

				return {
					messages: cached.messages,
					fromCache: true,
					cachedAt: cached.cachedAt,
					refreshing: true,
				};
			}

			return {
				messages: cached.messages,
				fromCache: true,
				cachedAt: cached.cachedAt,
				refreshing: false,
			};
		}
	}

	// Fetch fresh messages
	const fresh = await fetchFresh();

	// Cache the fresh messages (don't await to avoid blocking)
	setCachedMessages(chatId, fresh, ttlSeconds).catch((error) =>
		console.error("[messages-cache] Failed to cache fresh messages:", error)
	);

	// Transform to cached format for consistent return type
	const cachedMessages: CachedMessage[] = fresh
		.filter((msg) => msg.status !== "streaming")
		.map((msg) => ({
			_id: String(msg._id),
			clientMessageId: msg.clientMessageId,
			role: msg.role as "user" | "assistant",
			content: msg.content,
			reasoning: msg.reasoning,
			thinkingTimeMs: msg.thinkingTimeMs,
			status: msg.status as "streaming" | "completed" | undefined,
			streamId: msg.streamId,
			attachments: msg.attachments?.map((a) => ({
				storageId: String(a.storageId),
				filename: a.filename,
				contentType: a.contentType,
				size: a.size,
				uploadedAt: a.uploadedAt,
				url: a.url,
			})),
			createdAt: msg.createdAt,
			deletedAt: msg.deletedAt,
		}));

	return {
		messages: cachedMessages,
		fromCache: false,
		cachedAt: null,
		refreshing: false,
	};
}

// ============================================================================
// React Hook (Optional - for client-side usage)
// ============================================================================

/**
 * React hook result for cached messages.
 */
export interface UseCachedMessagesResult {
	/** Cached messages (null if not available) */
	messages: CachedMessage[] | null;
	/** True if cache check is in progress */
	isLoading: boolean;
	/** Unix timestamp when cached (null if not cached) */
	cachedAt: number | null;
	/** Function to invalidate the cache */
	invalidate: () => Promise<void>;
	/** Function to refresh the cache */
	refresh: (messages: ConvexMessageDoc[]) => Promise<void>;
}

/**
 * Server-side helper to pre-populate messages cache.
 *
 * Call this in API routes or server components to warm the cache
 * before the client makes Convex queries.
 *
 * @param chatId - The Convex chat ID
 * @param messages - Messages fetched from Convex
 * @param ttlSeconds - Optional TTL override
 *
 * @example
 * ```typescript
 * // In API route or server component
 * const messages = await listMessagesForChat(userId, chatId);
 * await warmMessagesCache(chatId, messages);
 * ```
 */
export async function warmMessagesCache(
	chatId: string,
	messages: ConvexMessageDoc[],
	ttlSeconds: number = MESSAGES_CACHE_TTL_SECONDS
): Promise<void> {
	await setCachedMessages(chatId, messages, ttlSeconds);
}

/**
 * Get cache statistics for debugging.
 *
 * @param chatId - The Convex chat ID
 * @returns Cache stats or null if not cached
 */
export async function getMessagesCacheStats(
	chatId: string
): Promise<{ messageCount: number; cachedAt: number; ageMs: number } | null> {
	const cached = await getCachedMessages(chatId);

	if (!cached) {
		return null;
	}

	return {
		messageCount: cached.messages.length,
		cachedAt: cached.cachedAt,
		ageMs: Date.now() - cached.cachedAt,
	};
}
