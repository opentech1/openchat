/**
 * Redis-based Presence and Typing Indicators System
 *
 * This module provides real-time presence tracking and typing indicators
 * built on top of the existing Redis client infrastructure.
 *
 * ARCHITECTURE:
 * - User presence: Auto-expiring keys (30s TTL, refreshed every 10s via heartbeat)
 * - Typing indicators: Short-lived keys (5s TTL) for responsive UI
 * - AI thinking: Tracks when AI is processing a response
 * - Graceful degradation: Returns sensible defaults when Redis unavailable
 *
 * KEY PATTERNS:
 * - presence:user:{userId}           - User's online status (expires in 30s)
 * - presence:typing:{chatId}:{userId} - User typing indicator (expires in 5s)
 * - presence:ai:{chatId}             - AI thinking indicator (expires in 60s)
 *
 * USAGE:
 * ```typescript
 * // User presence
 * await setUserOnline("user123");
 * await heartbeat("user123");  // Call every 10s
 * const status = await getUserPresence("user123");
 *
 * // Typing indicators
 * await setTyping("chat456", "user123", true);
 * const typingUsers = await getTypingUsers("chat456");
 *
 * // AI thinking
 * await setAIThinking("chat456", true);
 * const isThinking = await isAIThinking("chat456");
 * ```
 *
 * @see redis.ts for the underlying Redis client
 * @see cache.ts for general caching utilities
 */

import { redis, isRedisStreamingAvailable } from "./redis";

// ============================================================================
// Constants
// ============================================================================

/**
 * TTL values in seconds
 */
const TTL = {
	/** User presence TTL - should be refreshed every 10s */
	PRESENCE: 30,
	/** Typing indicator TTL - auto-expires quickly */
	TYPING: 5,
	/** AI thinking indicator TTL - longer to handle slow responses */
	AI_THINKING: 60,
} as const;

/**
 * Key prefixes for presence namespace
 */
const KEY_PREFIX = {
	/** User online status */
	user: "presence:user:",
	/** User typing in chat */
	typing: "presence:typing:",
	/** AI processing response */
	ai: "presence:ai:",
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * User presence state
 */
export interface PresenceState {
	/** Whether the user is currently online */
	online: boolean;
	/** Unix timestamp of last activity (ms) */
	lastSeen?: number;
}

/**
 * Typing indicator state
 */
export interface TypingState {
	/** User ID who is typing */
	userId: string;
	/** Chat ID where typing occurs */
	chatId: string;
	/** Whether user is currently typing */
	isTyping: boolean;
	/** Unix timestamp when typing started (ms) */
	timestamp: number;
}

/**
 * Internal presence data stored in Redis
 */
interface PresenceData {
	online: boolean;
	lastSeen: number;
}

// ============================================================================
// Availability Check
// ============================================================================

/**
 * Check if presence system is available
 *
 * @returns True if Redis is configured and presence can be used
 */
export function isPresenceAvailable(): boolean {
	return isRedisStreamingAvailable();
}

// ============================================================================
// User Presence
// ============================================================================

/**
 * Set a user as online
 *
 * Creates/refreshes a presence key with 30s TTL.
 * Call this when user connects or performs an action.
 *
 * @param userId - The user's ID
 *
 * @example
 * ```typescript
 * // When user opens the app
 * await setUserOnline("user_abc123");
 * ```
 */
export async function setUserOnline(userId: string): Promise<void> {
	if (!isPresenceAvailable()) {
		return;
	}

	try {
		const client = await redis.get();
		const key = `${KEY_PREFIX.user}${userId}`;
		const data: PresenceData = {
			online: true,
			lastSeen: Date.now(),
		};
		await client.set(key, JSON.stringify(data), { ex: TTL.PRESENCE });
	} catch (error) {
		console.error("[presence] Error setting user online:", userId, error);
		// Fail silently - presence is non-critical
	}
}

/**
 * Set a user as offline
 *
 * Immediately removes the presence key.
 * Call this when user explicitly logs out.
 *
 * @param userId - The user's ID
 *
 * @example
 * ```typescript
 * // When user logs out
 * await setUserOffline("user_abc123");
 * ```
 */
export async function setUserOffline(userId: string): Promise<void> {
	if (!isPresenceAvailable()) {
		return;
	}

	try {
		const client = await redis.get();
		const key = `${KEY_PREFIX.user}${userId}`;
		await client.del(key);
	} catch (error) {
		console.error("[presence] Error setting user offline:", userId, error);
		// Fail silently - presence is non-critical
	}
}

/**
 * Get a user's presence state
 *
 * Returns online status and last seen timestamp.
 * Returns offline state if Redis unavailable or on error.
 *
 * @param userId - The user's ID
 * @returns Presence state with online status and lastSeen timestamp
 *
 * @example
 * ```typescript
 * const presence = await getUserPresence("user_abc123");
 * if (presence.online) {
 *   console.log("User is online");
 * } else if (presence.lastSeen) {
 *   console.log(`Last seen: ${new Date(presence.lastSeen)}`);
 * }
 * ```
 */
export async function getUserPresence(userId: string): Promise<PresenceState> {
	if (!isPresenceAvailable()) {
		return { online: false };
	}

	try {
		const client = await redis.get();
		const key = `${KEY_PREFIX.user}${userId}`;
		const data = await client.get<string>(key);

		if (!data) {
			return { online: false };
		}

		try {
			const parsed: PresenceData = typeof data === "object" ? data : JSON.parse(data);
			return {
				online: parsed.online,
				lastSeen: parsed.lastSeen,
			};
		} catch {
			console.warn("[presence] Failed to parse presence data for user:", userId);
			return { online: false };
		}
	} catch (error) {
		console.error("[presence] Error getting user presence:", userId, error);
		return { online: false };
	}
}

/**
 * Get presence for multiple users
 *
 * Efficiently fetches presence for multiple users in a single operation.
 *
 * @param userIds - Array of user IDs
 * @returns Map of userId to PresenceState
 *
 * @example
 * ```typescript
 * const presenceMap = await getMultipleUserPresence(["user1", "user2", "user3"]);
 * for (const [userId, presence] of presenceMap) {
 *   console.log(`${userId}: ${presence.online ? "online" : "offline"}`);
 * }
 * ```
 */
export async function getMultipleUserPresence(
	userIds: string[],
): Promise<Map<string, PresenceState>> {
	const result = new Map<string, PresenceState>();

	// Initialize all as offline
	for (const userId of userIds) {
		result.set(userId, { online: false });
	}

	if (!isPresenceAvailable() || userIds.length === 0) {
		return result;
	}

	try {
		const client = await redis.get();
		const keys = userIds.map((id) => `${KEY_PREFIX.user}${id}`);
		const values = await client.mget<(string | null)[]>(...keys);

		for (let i = 0; i < userIds.length; i++) {
			const userId = userIds[i];
			const data = values[i];

			if (data) {
				try {
					const parsed: PresenceData = typeof data === "object" ? data : JSON.parse(data);
					result.set(userId, {
						online: parsed.online,
						lastSeen: parsed.lastSeen,
					});
				} catch {
					// Keep as offline on parse error
				}
			}
		}
	} catch (error) {
		console.error("[presence] Error getting multiple user presence:", error);
		// Return all offline on error
	}

	return result;
}

/**
 * Refresh user presence (heartbeat)
 *
 * Call this every 10 seconds to keep user marked as online.
 * This is an alias for setUserOnline for semantic clarity.
 *
 * @param userId - The user's ID
 *
 * @example
 * ```typescript
 * // In a useEffect or interval
 * useEffect(() => {
 *   const interval = setInterval(() => {
 *     heartbeat(userId);
 *   }, 10000);
 *   return () => clearInterval(interval);
 * }, [userId]);
 * ```
 */
export async function heartbeat(userId: string): Promise<void> {
	await setUserOnline(userId);
}

// ============================================================================
// Typing Indicators
// ============================================================================

/**
 * Set typing indicator for a user in a chat
 *
 * When isTyping is true, creates a key with 5s TTL.
 * When isTyping is false, immediately removes the key.
 *
 * @param chatId - The chat ID
 * @param userId - The user's ID
 * @param isTyping - Whether the user is currently typing
 *
 * @example
 * ```typescript
 * // When user starts typing
 * await setTyping("chat_456", "user_123", true);
 *
 * // When user stops typing or sends message
 * await setTyping("chat_456", "user_123", false);
 * ```
 */
export async function setTyping(
	chatId: string,
	userId: string,
	isTyping: boolean,
): Promise<void> {
	if (!isPresenceAvailable()) {
		return;
	}

	try {
		const client = await redis.get();
		const key = `${KEY_PREFIX.typing}${chatId}:${userId}`;

		if (isTyping) {
			// Set typing with short TTL
			await client.set(key, Date.now().toString(), { ex: TTL.TYPING });
		} else {
			// Immediately remove typing indicator
			await client.del(key);
		}
	} catch (error) {
		console.error("[presence] Error setting typing indicator:", chatId, userId, error);
		// Fail silently - typing indicators are non-critical
	}
}

/**
 * Get all users currently typing in a chat
 *
 * Returns array of user IDs who are typing.
 * Returns empty array if Redis unavailable or on error.
 *
 * @param chatId - The chat ID
 * @returns Array of user IDs who are typing
 *
 * @example
 * ```typescript
 * const typingUsers = await getTypingUsers("chat_456");
 * if (typingUsers.length > 0) {
 *   console.log(`${typingUsers.join(", ")} are typing...`);
 * }
 * ```
 */
export async function getTypingUsers(chatId: string): Promise<string[]> {
	if (!isPresenceAvailable()) {
		return [];
	}

	try {
		const client = await redis.get();
		const pattern = `${KEY_PREFIX.typing}${chatId}:*`;
		const keys = await client.keys(pattern);

		if (keys.length === 0) {
			return [];
		}

		// Extract user IDs from key names
		// Key format: presence:typing:{chatId}:{userId}
		const prefix = `${KEY_PREFIX.typing}${chatId}:`;
		const userIds = keys.map((key) => key.replace(prefix, ""));

		return userIds;
	} catch (error) {
		console.error("[presence] Error getting typing users:", chatId, error);
		return [];
	}
}

/**
 * Clear all typing indicators for a chat
 *
 * Useful when a chat is deleted or for cleanup.
 *
 * @param chatId - The chat ID
 * @returns Number of indicators cleared
 *
 * @example
 * ```typescript
 * // When chat is deleted
 * await clearTypingForChat("chat_456");
 * ```
 */
export async function clearTypingForChat(chatId: string): Promise<number> {
	if (!isPresenceAvailable()) {
		return 0;
	}

	try {
		const client = await redis.get();
		const pattern = `${KEY_PREFIX.typing}${chatId}:*`;
		const keys = await client.keys(pattern);

		if (keys.length === 0) {
			return 0;
		}

		const deleted = await client.del(...keys);
		return deleted;
	} catch (error) {
		console.error("[presence] Error clearing typing for chat:", chatId, error);
		return 0;
	}
}

// ============================================================================
// AI Thinking Indicator
// ============================================================================

/**
 * Set AI thinking indicator for a chat
 *
 * Use this to show when the AI is processing a response.
 * Has a longer TTL (60s) to handle slow AI responses.
 *
 * @param chatId - The chat ID
 * @param isThinking - Whether the AI is currently thinking
 *
 * @example
 * ```typescript
 * // When AI starts processing
 * await setAIThinking("chat_456", true);
 *
 * // When AI response is complete or error occurs
 * await setAIThinking("chat_456", false);
 * ```
 */
export async function setAIThinking(
	chatId: string,
	isThinking: boolean,
): Promise<void> {
	if (!isPresenceAvailable()) {
		return;
	}

	try {
		const client = await redis.get();
		const key = `${KEY_PREFIX.ai}${chatId}`;

		if (isThinking) {
			// Set thinking with longer TTL for slow responses
			await client.set(key, Date.now().toString(), { ex: TTL.AI_THINKING });
		} else {
			// Immediately remove thinking indicator
			await client.del(key);
		}
	} catch (error) {
		console.error("[presence] Error setting AI thinking:", chatId, error);
		// Fail silently - thinking indicator is non-critical
	}
}

/**
 * Check if AI is currently thinking in a chat
 *
 * @param chatId - The chat ID
 * @returns True if AI is thinking, false otherwise
 *
 * @example
 * ```typescript
 * const thinking = await isAIThinking("chat_456");
 * if (thinking) {
 *   showAIThinkingIndicator();
 * }
 * ```
 */
export async function isAIThinking(chatId: string): Promise<boolean> {
	if (!isPresenceAvailable()) {
		return false;
	}

	try {
		const client = await redis.get();
		const key = `${KEY_PREFIX.ai}${chatId}`;
		const exists = await client.exists(key);
		return exists > 0;
	} catch (error) {
		console.error("[presence] Error checking AI thinking:", chatId, error);
		return false;
	}
}

/**
 * Get AI thinking start time
 *
 * Returns the timestamp when AI started thinking, useful for
 * showing "thinking for X seconds" UI.
 *
 * @param chatId - The chat ID
 * @returns Timestamp when thinking started, or null if not thinking
 *
 * @example
 * ```typescript
 * const startTime = await getAIThinkingStartTime("chat_456");
 * if (startTime) {
 *   const elapsed = Date.now() - startTime;
 *   console.log(`AI has been thinking for ${elapsed}ms`);
 * }
 * ```
 */
export async function getAIThinkingStartTime(chatId: string): Promise<number | null> {
	if (!isPresenceAvailable()) {
		return null;
	}

	try {
		const client = await redis.get();
		const key = `${KEY_PREFIX.ai}${chatId}`;
		const data = await client.get<string>(key);

		if (!data) {
			return null;
		}

		const timestamp = parseInt(typeof data === "string" ? data : String(data), 10);
		return isNaN(timestamp) ? null : timestamp;
	} catch (error) {
		console.error("[presence] Error getting AI thinking start time:", chatId, error);
		return null;
	}
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Clear all presence data for a user
 *
 * Removes all presence keys including typing indicators.
 * Useful when user account is deleted.
 *
 * @param userId - The user's ID
 *
 * @example
 * ```typescript
 * // When user account is deleted
 * await clearAllPresenceForUser("user_123");
 * ```
 */
export async function clearAllPresenceForUser(userId: string): Promise<void> {
	if (!isPresenceAvailable()) {
		return;
	}

	try {
		const client = await redis.get();

		// Delete user presence
		const userKey = `${KEY_PREFIX.user}${userId}`;

		// Find and delete all typing indicators for this user
		const typingPattern = `${KEY_PREFIX.typing}*:${userId}`;
		const typingKeys = await client.keys(typingPattern);

		const keysToDelete = [userKey, ...typingKeys];
		if (keysToDelete.length > 0) {
			await client.del(...keysToDelete);
		}
	} catch (error) {
		console.error("[presence] Error clearing all presence for user:", userId, error);
	}
}

// ============================================================================
// Export TTL constants for external use
// ============================================================================

export const PRESENCE_TTL = TTL;
