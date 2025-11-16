/**
 * Database Statistics Helpers
 *
 * PERFORMANCE OPTIMIZATION: Provides efficient counter management for database statistics.
 * Instead of expensive full-table scans with .collect().then(c => c.length), we maintain
 * counters in a dedicated stats table.
 *
 * Benefits:
 * - O(1) reads instead of O(n) full table scans
 * - Minimal write overhead (single counter update per operation)
 * - Enables real-time monitoring without performance impact
 *
 * Usage:
 * - Call incrementStat/decrementStat when records are created/deleted
 * - Call getStat to retrieve current count
 * - Call initializeStat to set initial value (e.g., during migration)
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Retrieves a stat value by key. Returns 0 if stat doesn't exist.
 *
 * @param ctx - Query or Mutation context
 * @param key - Unique identifier for the stat
 * @returns Current value of the stat
 */
export async function getStat(
	ctx: QueryCtx | MutationCtx,
	key: string
): Promise<number> {
	const stat = await ctx.db
		.query("dbStats")
		.withIndex("by_key", (q) => q.eq("key", key))
		.unique();

	return stat?.value ?? 0;
}

/**
 * Increments a stat by a given amount (default 1).
 * Creates the stat if it doesn't exist.
 *
 * @param ctx - Mutation context
 * @param key - Unique identifier for the stat
 * @param amount - Amount to increment by (default: 1)
 */
export async function incrementStat(
	ctx: MutationCtx,
	key: string,
	amount: number = 1
): Promise<void> {
	const stat = await ctx.db
		.query("dbStats")
		.withIndex("by_key", (q) => q.eq("key", key))
		.unique();

	if (stat) {
		await ctx.db.patch(stat._id, {
			value: stat.value + amount,
			updatedAt: Date.now(),
		});
	} else {
		await ctx.db.insert("dbStats", {
			key,
			value: amount,
			updatedAt: Date.now(),
		});
	}
}

/**
 * Decrements a stat by a given amount (default 1).
 * Prevents going below 0. Creates the stat if it doesn't exist.
 *
 * @param ctx - Mutation context
 * @param key - Unique identifier for the stat
 * @param amount - Amount to decrement by (default: 1)
 */
export async function decrementStat(
	ctx: MutationCtx,
	key: string,
	amount: number = 1
): Promise<void> {
	const stat = await ctx.db
		.query("dbStats")
		.withIndex("by_key", (q) => q.eq("key", key))
		.unique();

	if (stat) {
		await ctx.db.patch(stat._id, {
			value: Math.max(0, stat.value - amount),
			updatedAt: Date.now(),
		});
	} else {
		// If stat doesn't exist, create it with 0 (can't go negative)
		await ctx.db.insert("dbStats", {
			key,
			value: 0,
			updatedAt: Date.now(),
		});
	}
}

/**
 * Sets a stat to a specific value. Creates the stat if it doesn't exist.
 * Useful for initialization or corrections.
 *
 * @param ctx - Mutation context
 * @param key - Unique identifier for the stat
 * @param value - Value to set
 * @param metadata - Optional metadata for the stat
 */
export async function setStat(
	ctx: MutationCtx,
	key: string,
	value: number,
	metadata?: {
		description?: string;
		category?: string;
	}
): Promise<void> {
	const stat = await ctx.db
		.query("dbStats")
		.withIndex("by_key", (q) => q.eq("key", key))
		.unique();

	if (stat) {
		await ctx.db.patch(stat._id, {
			value,
			updatedAt: Date.now(),
			...(metadata ? { metadata } : {}),
		});
	} else {
		await ctx.db.insert("dbStats", {
			key,
			value,
			updatedAt: Date.now(),
			...(metadata ? { metadata } : {}),
		});
	}
}

/**
 * Retrieves multiple stats at once.
 *
 * @param ctx - Query or Mutation context
 * @param keys - Array of stat keys to retrieve
 * @returns Object mapping keys to values (0 if not found)
 */
export async function getStats(
	ctx: QueryCtx | MutationCtx,
	keys: string[]
): Promise<Record<string, number>> {
	const result: Record<string, number> = {};

	for (const key of keys) {
		result[key] = await getStat(ctx, key);
	}

	return result;
}

// Standard stat keys used across the application
export const STAT_KEYS = {
	CHATS_TOTAL: "chats_total",
	CHATS_SOFT_DELETED: "chats_soft_deleted",
	MESSAGES_TOTAL: "messages_total",
	MESSAGES_SOFT_DELETED: "messages_soft_deleted",
	USERS_TOTAL: "users_total",
} as const;
