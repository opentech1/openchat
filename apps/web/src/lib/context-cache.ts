/**
 * Context Window Caching Layer for AI Request Assembly
 *
 * This module provides caching for prepared AI context windows to speed up
 * repeated requests within the same chat session. It caches the assembled
 * message history and system prompts that would otherwise be rebuilt on
 * every request.
 *
 * ARCHITECTURE:
 * - Built on top of the unified cache layer (cache.ts)
 * - Uses Redis for fast, distributed caching
 * - Fail-open: returns null on cache errors (never blocks requests)
 * - TTL-based expiration with validation checks
 *
 * CACHE STRATEGY:
 * - Only cache chats with sufficient message history (> MIN_MESSAGES_TO_CACHE)
 * - Validate cache freshness using message count
 * - Invalidate when streaming is in progress
 * - 5-minute TTL (context changes less frequently than individual messages)
 *
 * USAGE:
 * ```typescript
 * // Check cache before assembling context
 * const cached = await getCachedContext(chatId);
 * if (cached && isContextValid(cached, currentMessageCount)) {
 *   // Use cached.messages for AI call
 * } else {
 *   // Assemble context and cache it
 *   await setCachedContext(chatId, context);
 * }
 * ```
 *
 * @see cache.ts for the underlying cache implementation
 */

import { cacheGet, cacheSet, cacheDelete, isRedisCacheAvailable, CACHE_PREFIX } from "./cache";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Minimum number of messages required before caching context.
 * Caching small conversations provides little benefit and adds overhead.
 */
const MIN_MESSAGES_TO_CACHE = 5;

/**
 * Default TTL for context cache in seconds.
 * 5 minutes - longer than message cache since context changes less frequently.
 */
const CONTEXT_CACHE_TTL_SECONDS = 300;

/**
 * Maximum age of cached context in milliseconds before forced refresh.
 * Even with message count validation, force refresh after this time.
 */
const MAX_CONTEXT_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Types
// ============================================================================

/**
 * Message structure for AI context window.
 * Matches the format expected by OpenRouter/AI SDK.
 */
export interface ContextMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

/**
 * Cached context window data structure.
 *
 * Contains the pre-assembled messages and metadata for validation.
 */
export interface ContextWindow {
	/** Chat ID this context belongs to */
	chatId: string;

	/** Pre-assembled messages for AI call (system prompt + conversation history) */
	messages: ContextMessage[];

	/** Optional system prompt (if separate from messages) */
	systemPrompt?: string;

	/** Number of user/assistant messages (excluding system prompts) */
	messageCount: number;

	/** Estimated token count for context window */
	totalTokens?: number;

	/** Timestamp when this context was cached */
	cachedAt: number;

	/** Flag indicating if streaming was in progress when cached (should not be cached) */
	streamingInProgress?: boolean;
}

/**
 * Result of context cache lookup.
 */
export interface ContextCacheResult {
	/** Whether cache hit occurred */
	hit: boolean;

	/** Cached context window (null if miss) */
	context: ContextWindow | null;

	/** Reason for cache miss (for debugging/analytics) */
	missReason?: "not_found" | "stale" | "message_count_mismatch" | "streaming" | "redis_unavailable" | "too_few_messages";
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for a text string.
 *
 * Uses a simple heuristic: ~4 characters per token on average.
 * This is an approximation based on typical English text tokenization.
 *
 * For more accurate counting, use a proper tokenizer like tiktoken.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * const tokens = estimateTokens("Hello, how are you?");
 * // => 5 (19 chars / 4)
 * ```
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for an array of messages.
 *
 * Includes overhead for message structure (role labels, formatting).
 *
 * @param messages - Array of context messages
 * @returns Estimated total token count
 */
export function estimateContextTokens(messages: ContextMessage[]): number {
	let total = 0;

	for (const message of messages) {
		// Role overhead (~4 tokens for role label and formatting)
		total += 4;
		// Content tokens
		total += estimateTokens(message.content);
	}

	// Base overhead for message array structure (~3 tokens)
	total += 3;

	return total;
}

// ============================================================================
// Cache Key Helpers
// ============================================================================

/**
 * Generate cache key for a chat's context window.
 *
 * @param chatId - Chat ID
 * @returns Cache key in format: cache:context:{chatId}
 */
export function getContextCacheKey(chatId: string): string {
	return `${CACHE_PREFIX.context}${chatId}`;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if a cached context window is still valid.
 *
 * Validation rules:
 * 1. Message count must match current conversation length
 * 2. Context must not be older than MAX_CONTEXT_AGE_MS
 * 3. Streaming must not have been in progress when cached
 *
 * @param cached - Cached context window
 * @param currentMessageCount - Current number of messages in the conversation
 * @returns True if cache is valid, false if stale
 *
 * @example
 * ```typescript
 * const cached = await getCachedContext(chatId);
 * if (cached && isContextValid(cached, messages.length)) {
 *   // Safe to use cached context
 * }
 * ```
 */
export function isContextValid(
	cached: ContextWindow,
	currentMessageCount: number
): boolean {
	// Context is invalid if streaming was in progress
	if (cached.streamingInProgress) {
		return false;
	}

	// Context is invalid if message count changed
	if (cached.messageCount !== currentMessageCount) {
		return false;
	}

	// Context is invalid if too old
	const age = Date.now() - cached.cachedAt;
	if (age > MAX_CONTEXT_AGE_MS) {
		return false;
	}

	return true;
}

/**
 * Check if a conversation should be cached based on message count.
 *
 * Small conversations don't benefit from caching and add unnecessary overhead.
 *
 * @param messageCount - Number of messages in conversation
 * @returns True if conversation is large enough to benefit from caching
 */
export function shouldCacheContext(messageCount: number): boolean {
	return messageCount > MIN_MESSAGES_TO_CACHE;
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get cached context window for a chat.
 *
 * This is a low-level cache lookup. Use getCachedContextWithValidation()
 * for full validation including message count checks.
 *
 * @param chatId - Chat ID to look up
 * @returns Cached context or null if not found/error
 *
 * @example
 * ```typescript
 * const cached = await getCachedContext("chat_abc123");
 * if (cached) {
 *   console.log(`Cached context with ${cached.messages.length} messages`);
 * }
 * ```
 */
export async function getCachedContext(
	chatId: string
): Promise<ContextWindow | null> {
	if (!isRedisCacheAvailable()) {
		return null;
	}

	const key = getContextCacheKey(chatId);
	return cacheGet<ContextWindow>(key);
}

/**
 * Get cached context with full validation.
 *
 * Performs cache lookup and validates against current message count.
 * Returns detailed result including miss reason for analytics.
 *
 * @param chatId - Chat ID to look up
 * @param currentMessageCount - Current number of messages for validation
 * @param isStreaming - Whether streaming is currently in progress
 * @returns Cache result with hit/miss status and reason
 *
 * @example
 * ```typescript
 * const result = await getCachedContextWithValidation(chatId, messages.length, false);
 * if (result.hit && result.context) {
 *   // Use cached context
 * } else {
 *   console.log(`Cache miss: ${result.missReason}`);
 *   // Assemble context fresh
 * }
 * ```
 */
export async function getCachedContextWithValidation(
	chatId: string,
	currentMessageCount: number,
	isStreaming: boolean = false
): Promise<ContextCacheResult> {
	// Don't use cache during streaming
	if (isStreaming) {
		return { hit: false, context: null, missReason: "streaming" };
	}

	// Check Redis availability
	if (!isRedisCacheAvailable()) {
		return { hit: false, context: null, missReason: "redis_unavailable" };
	}

	// Don't cache small conversations
	if (!shouldCacheContext(currentMessageCount)) {
		return { hit: false, context: null, missReason: "too_few_messages" };
	}

	// Look up cache
	const cached = await getCachedContext(chatId);
	if (!cached) {
		return { hit: false, context: null, missReason: "not_found" };
	}

	// Validate cache
	if (!isContextValid(cached, currentMessageCount)) {
		// Determine specific reason
		if (cached.streamingInProgress) {
			return { hit: false, context: null, missReason: "streaming" };
		}
		if (cached.messageCount !== currentMessageCount) {
			return { hit: false, context: null, missReason: "message_count_mismatch" };
		}
		return { hit: false, context: null, missReason: "stale" };
	}

	return { hit: true, context: cached };
}

/**
 * Cache a context window for a chat.
 *
 * Only caches if:
 * 1. Redis is available
 * 2. Message count exceeds minimum threshold
 * 3. Streaming is not in progress
 *
 * @param chatId - Chat ID to cache context for
 * @param context - Context window to cache
 * @param options - Optional configuration
 * @returns True if cached successfully, false otherwise
 *
 * @example
 * ```typescript
 * const context: ContextWindow = {
 *   chatId,
 *   messages: assembledMessages,
 *   messageCount: rawMessages.length,
 *   totalTokens: estimateContextTokens(assembledMessages),
 *   cachedAt: Date.now(),
 * };
 *
 * await setCachedContext(chatId, context);
 * ```
 */
export async function setCachedContext(
	chatId: string,
	context: ContextWindow,
	options: { ttlSeconds?: number } = {}
): Promise<boolean> {
	// Don't cache during streaming
	if (context.streamingInProgress) {
		return false;
	}

	// Don't cache small conversations
	if (!shouldCacheContext(context.messageCount)) {
		return false;
	}

	// Check Redis availability
	if (!isRedisCacheAvailable()) {
		return false;
	}

	const key = getContextCacheKey(chatId);
	const ttl = options.ttlSeconds ?? CONTEXT_CACHE_TTL_SECONDS;

	return cacheSet(key, context, { ttlSeconds: ttl });
}

/**
 * Invalidate cached context for a chat.
 *
 * Call this when:
 * - A new message is added to the chat
 * - A message is deleted or edited
 * - The system prompt changes
 * - Any other event that changes the context
 *
 * @param chatId - Chat ID to invalidate
 * @returns True if invalidated, false if not found or error
 *
 * @example
 * ```typescript
 * // After saving a new message
 * await persistMessage(chatId, message);
 * await invalidateContextCache(chatId);
 * ```
 */
export async function invalidateContextCache(
	chatId: string
): Promise<boolean> {
	if (!isRedisCacheAvailable()) {
		return false;
	}

	const key = getContextCacheKey(chatId);
	return cacheDelete(key);
}

// ============================================================================
// Context Assembly Helpers
// ============================================================================

/**
 * Build a context window from raw messages.
 *
 * This is a helper for creating a cacheable context window from
 * the raw message array received in chat requests.
 *
 * @param chatId - Chat ID
 * @param messages - Array of messages with role and content
 * @param options - Optional configuration
 * @returns Context window ready for caching
 *
 * @example
 * ```typescript
 * const context = buildContextWindow(chatId, [
 *   { role: "system", content: "You are a helpful assistant" },
 *   { role: "user", content: "Hello" },
 *   { role: "assistant", content: "Hi! How can I help?" },
 * ]);
 *
 * await setCachedContext(chatId, context);
 * ```
 */
export function buildContextWindow(
	chatId: string,
	messages: ContextMessage[],
	options: {
		systemPrompt?: string;
		streamingInProgress?: boolean;
	} = {}
): ContextWindow {
	// Count non-system messages (user + assistant)
	const messageCount = messages.filter(m => m.role !== "system").length;

	// Estimate tokens
	const totalTokens = estimateContextTokens(messages);

	return {
		chatId,
		messages,
		systemPrompt: options.systemPrompt,
		messageCount,
		totalTokens,
		cachedAt: Date.now(),
		streamingInProgress: options.streamingInProgress ?? false,
	};
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { isRedisCacheAvailable };
