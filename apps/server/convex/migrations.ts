/**
 * Database Migrations
 *
 * One-time scripts to migrate existing data to new schema or fix data inconsistencies.
 * These are typically run manually via the Convex dashboard or CLI.
 *
 * IMPORTANT: These are not automatic migrations - they must be triggered manually.
 * Run them once during deployment when schema changes require data updates.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { setStat, STAT_KEYS } from "./lib/dbStats";

/**
 * Initialize database statistics counters
 *
 * PERFORMANCE OPTIMIZATION: Populates the dbStats table with initial counts.
 * This is a one-time migration to backfill stats for existing data.
 *
 * Run this after deploying the new schema with dbStats table.
 *
 * @example
 * ```bash
 * # Run via Convex CLI:
 * npx convex run migrations:initializeStats
 * ```
 */
export const initializeStats = internalMutation({
	args: {
		// Allow re-running to fix inconsistencies
		force: v.optional(v.boolean()),
	},
	handler: async (ctx, _args) => {
		console.log("[Migration] Initialize stats - Started");

		try {
			// Count all records in each table
			console.log("[Migration] Counting chats...");
			const allChats = await ctx.db.query("chats").collect();
			const chatsTotal = allChats.length;
			const chatsSoftDeleted = allChats.filter((c) => c.deletedAt !== undefined).length;

			console.log("[Migration] Counting messages...");
			const allMessages = await ctx.db.query("messages").collect();
			const messagesTotal = allMessages.length;
			const messagesSoftDeleted = allMessages.filter((m) => m.deletedAt !== undefined).length;

			console.log("[Migration] Counting users...");
			const allUsers = await ctx.db.query("users").collect();
			const usersTotal = allUsers.length;

			// Set all stats
			await setStat(ctx, STAT_KEYS.CHATS_TOTAL, chatsTotal, {
				description: "Total number of chats (including soft-deleted)",
				category: "chats",
			});
			await setStat(ctx, STAT_KEYS.CHATS_SOFT_DELETED, chatsSoftDeleted, {
				description: "Number of soft-deleted chats",
				category: "chats",
			});
			await setStat(ctx, STAT_KEYS.MESSAGES_TOTAL, messagesTotal, {
				description: "Total number of messages (including soft-deleted)",
				category: "messages",
			});
			await setStat(ctx, STAT_KEYS.MESSAGES_SOFT_DELETED, messagesSoftDeleted, {
				description: "Number of soft-deleted messages",
				category: "messages",
			});
			await setStat(ctx, STAT_KEYS.USERS_TOTAL, usersTotal, {
				description: "Total number of users",
				category: "users",
			});

			const results = {
				chatsTotal,
				chatsSoftDeleted,
				messagesTotal,
				messagesSoftDeleted,
				usersTotal,
			};

			console.log("[Migration] Initialize stats - Completed", results);

			return {
				success: true,
				results,
			};
		} catch (error) {
			console.error("[Migration] Initialize stats - Failed", error);
			throw error;
		}
	},
});

/**
 * Backfill messageCount field for existing chats
 *
 * PERFORMANCE OPTIMIZATION: Populates the messageCount field for all existing chats.
 * This is a one-time migration to backfill counts for existing data.
 *
 * Run this after deploying the new schema with messageCount field.
 *
 * @example
 * ```bash
 * # Run via Convex CLI:
 * npx convex run migrations:backfillMessageCounts
 * ```
 */
export const backfillMessageCounts = internalMutation({
	args: {
		// Process in batches to avoid overwhelming the database
		batchSize: v.optional(v.number()),
		// Skip chats that already have messageCount set
		skipExisting: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const batchSize = args.batchSize ?? 100;
		const skipExisting = args.skipExisting ?? true;

		console.log("[Migration] Backfill message counts - Started");
		console.log(`[Migration] Batch size: ${batchSize}, Skip existing: ${skipExisting}`);

		try {
			// Get all chats
			let chats = await ctx.db.query("chats").collect();

			// Filter out chats that already have messageCount if skipExisting is true
			if (skipExisting) {
				chats = chats.filter((c) => c.messageCount === undefined);
			}

			console.log(`[Migration] Processing ${chats.length} chats...`);

			let processed = 0;
			let updated = 0;

			// Process in batches
			let batchFailures = 0;
			for (let i = 0; i < chats.length; i += batchSize) {
				const batch = chats.slice(i, i + batchSize);

				const results = await Promise.allSettled(
					batch.map(async (chat) => {
						// Count non-deleted messages for this chat
						const messages = await ctx.db
							.query("messages")
							.withIndex("by_chat_not_deleted", (q) =>
								q.eq("chatId", chat._id).eq("deletedAt", undefined)
							)
							.collect();

						const messageCount = messages.length;

						// Update the chat with the message count
						await ctx.db.patch(chat._id, {
							messageCount,
						});

						return chat._id;
					})
				);

				const failures = results.filter(r => r.status === "rejected");
				const successes = results.filter(r => r.status === "fulfilled");
				updated += successes.length;
				batchFailures += failures.length;

				if (failures.length > 0) {
					console.log(`[Migration] ${failures.length} items failed in batch:`, failures.map(f => f.reason));
				}

				processed += batch.length;
				console.log(`[Migration] Processed ${processed}/${chats.length} chats...`);
			}

			if (batchFailures > 0) {
				console.log(`[Migration] Total failures: ${batchFailures}`);
			}

			console.log(`[Migration] Backfill message counts - Completed (${updated} chats updated)`);

			return {
				success: true,
				processed,
				updated,
			};
		} catch (error) {
			console.error("[Migration] Backfill message counts - Failed", error);
			throw error;
		}
	},
});

/**
 * Verify data consistency
 *
 * Checks that messageCount fields match actual message counts in the database.
 * Useful for debugging and ensuring migrations worked correctly.
 *
 * @example
 * ```bash
 * # Run via Convex CLI:
 * npx convex run migrations:verifyMessageCounts
 * ```
 */
export const verifyMessageCounts = internalMutation({
	args: {},
	handler: async (ctx) => {
		console.log("[Migration] Verify message counts - Started");

		try {
			const chats = await ctx.db.query("chats").collect();
			const inconsistencies: Array<{
				chatId: string;
				storedCount: number | undefined;
				actualCount: number;
			}> = [];

			for (const chat of chats) {
				// Count non-deleted messages for this chat
				const messages = await ctx.db
					.query("messages")
					.withIndex("by_chat_not_deleted", (q) =>
						q.eq("chatId", chat._id).eq("deletedAt", undefined)
					)
					.collect();

				const actualCount = messages.length;
				const storedCount = chat.messageCount;

				if (storedCount !== actualCount) {
					inconsistencies.push({
						chatId: chat._id,
						storedCount,
						actualCount,
					});
				}
			}

			if (inconsistencies.length > 0) {
				console.log(
					`[Migration] Found ${inconsistencies.length} inconsistencies:`,
					inconsistencies.slice(0, 10) // Log first 10
				);
			} else {
				console.log("[Migration] All message counts are consistent!");
			}

			console.log("[Migration] Verify message counts - Completed");

			return {
				success: true,
				totalChats: chats.length,
				inconsistencies: inconsistencies.length,
				samples: inconsistencies.slice(0, 10),
			};
		} catch (error) {
			console.error("[Migration] Verify message counts - Failed", error);
			throw error;
		}
	},
});

/**
 * Fix message count inconsistencies
 *
 * Repairs any chats where messageCount doesn't match the actual number of messages.
 * Run this if verifyMessageCounts finds inconsistencies.
 *
 * @example
 * ```bash
 * # Run via Convex CLI:
 * npx convex run migrations:fixMessageCounts
 * ```
 */
export const fixMessageCounts = internalMutation({
	args: {},
	handler: async (ctx) => {
		console.log("[Migration] Fix message counts - Started");

		try {
			const chats = await ctx.db.query("chats").collect();
			let fixed = 0;

			for (const chat of chats) {
				// Count non-deleted messages for this chat
				const messages = await ctx.db
					.query("messages")
					.withIndex("by_chat_not_deleted", (q) =>
						q.eq("chatId", chat._id).eq("deletedAt", undefined)
					)
					.collect();

				const actualCount = messages.length;
				const storedCount = chat.messageCount;

				if (storedCount !== actualCount) {
					await ctx.db.patch(chat._id, {
						messageCount: actualCount,
					});
					fixed++;
					console.log(
						`[Migration] Fixed chat ${chat._id}: ${storedCount} -> ${actualCount}`
					);
				}
			}

			console.log(`[Migration] Fix message counts - Completed (${fixed} chats fixed)`);

			return {
				success: true,
				totalChats: chats.length,
				fixed,
			};
		} catch (error) {
			console.error("[Migration] Fix message counts - Failed", error);
			throw error;
		}
	},
});

/**
 * Remove deprecated onboarding fields from users table
 *
 * Removes the following fields from all user records:
 * - onboardingCompletedAt
 * - displayName
 * - preferredTone
 * - customInstructions
 *
 * These fields were part of the initial onboarding flow but are no longer used.
 * This migration safely removes them from existing user records.
 *
 * IMPORTANT: This migration is idempotent - safe to run multiple times.
 * If a user already has these fields removed, they will be skipped.
 *
 * @example
 * ```bash
 * # Run via Convex CLI:
 * npx convex run migrations:removeOnboardingFields
 * ```
 */
export const removeOnboardingFields = internalMutation({
	args: {
		// Process in batches to avoid overwhelming the database
		batchSize: v.optional(v.number()),
		// Dry run mode - log what would be changed without making changes
		dryRun: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const batchSize = args.batchSize ?? 100;
		const dryRun = args.dryRun ?? false;

		console.log("[Migration] Remove onboarding fields - Started");
		console.log(`[Migration] Batch size: ${batchSize}, Dry run: ${dryRun}`);

		try {
			// Get all users
			const users = await ctx.db.query("users").collect();

			console.log(`[Migration] Processing ${users.length} users...`);

			let processed = 0;
			let updated = 0;
			const errors: Array<{ userId: string; error: string }> = [];

			// Process in batches
			for (let i = 0; i < users.length; i += batchSize) {
				const batch = users.slice(i, i + batchSize);

				const results = await Promise.allSettled(
					batch.map(async (user) => {
						// Check if user has any onboarding fields to remove
						const hasOnboardingFields =
							"onboardingCompletedAt" in user ||
							"displayName" in user ||
							"preferredTone" in user ||
							"customInstructions" in user;

						if (hasOnboardingFields) {
							if (dryRun) {
								console.log(
									`[Migration] [DRY RUN] Would remove onboarding fields from user ${user._id}`
								);
							} else {
								// Remove onboarding fields by setting them to undefined
								// Type assertion needed because these fields are deprecated and no longer in schema
								await ctx.db.patch(user._id, {
									onboardingCompletedAt: undefined,
									displayName: undefined,
									preferredTone: undefined,
									customInstructions: undefined,
									updatedAt: Date.now(),
								} as any);
								console.log(
									`[Migration] Removed onboarding fields from user ${user._id}`
								);
							}
							return { userId: user._id, updated: true };
						}
						return { userId: user._id, updated: false };
					})
				);

				// Handle results
				for (const result of results) {
					if (result.status === "rejected") {
						const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
						console.error(`[Migration] Error processing user in batch:`, errorMessage);
						errors.push({
							userId: "unknown",
							error: errorMessage,
						});
					} else if (result.value.updated) {
						updated++;
					}
				}

				const batchFailures = results.filter(r => r.status === "rejected");
				if (batchFailures.length > 0) {
					console.log(`[Migration] ${batchFailures.length} items failed in batch`);
				}

				processed += batch.length;
				console.log(`[Migration] Processed ${processed}/${users.length} users...`);
			}

			const message = dryRun
				? `[Migration] Remove onboarding fields - Dry run completed (${updated} users would be updated)`
				: `[Migration] Remove onboarding fields - Completed (${updated} users updated)`;

			console.log(message);

			if (errors.length > 0) {
				console.error(`[Migration] Encountered ${errors.length} errors:`, errors);
			}

			return {
				success: true,
				dryRun,
				totalUsers: users.length,
				processed,
				updated,
				errors: errors.length,
				errorDetails: errors.slice(0, 10), // Return first 10 errors
			};
		} catch (error) {
			console.error("[Migration] Remove onboarding fields - Failed", error);
			throw error;
		}
	},
});
