/**
 * Convex Cron Jobs
 *
 * Scheduled tasks for database maintenance and cleanup.
 *
 * IMPORTANT: Configure these cron schedules in your Convex dashboard:
 * https://docs.convex.dev/scheduling/cron-jobs
 *
 * To add a cron job:
 * 1. Define the function here
 * 2. Export it with `export default internalMutation` or `internalAction`
 * 3. Configure the schedule in Convex dashboard under "Crons"
 */

import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { decrementStat, getStats, STAT_KEYS } from "./lib/dbStats";

const crons = cronJobs();

export default crons;

/**
 * Cleanup soft-deleted records
 *
 * SECURITY & MAINTENANCE:
 * - Soft deleted records accumulate over time, causing database bloat
 * - This can degrade query performance and increase storage costs
 * - Hard delete records that have been soft-deleted for > 90 days
 *
 * RETENTION POLICY:
 * - 90 days is sufficient for most compliance requirements
 * - Adjust retention period based on your organization's policies
 * - Consider legal hold requirements before modifying
 *
 * AUDIT CONSIDERATIONS:
 * - Ensure audit logs are retained separately from deleted records
 * - Hard deletion should itself be logged for compliance
 * - Consider archiving to cold storage instead of deletion
 *
 * SCHEDULE RECOMMENDATION:
 * - Run daily at off-peak hours (e.g., 2 AM UTC)
 * - Batch size of 100 to avoid overwhelming the database
 * - Monitor execution time and adjust batch size if needed
 *
 * CONVEX DASHBOARD CONFIGURATION:
 * Name: cleanup-soft-deleted-records
 * Schedule: cron(0 2 * * *) // Daily at 2 AM UTC
 * Function: crons:cleanupSoftDeletedRecords
 *
 * @example
 * ```bash
 * # Configure in Convex dashboard or via CLI:
 * npx convex crons schedule --name cleanup-soft-deleted-records \
 *   --schedule "0 2 * * *" \
 *   --function crons:cleanupSoftDeletedRecords
 * ```
 */
export const cleanupSoftDeletedRecords = internalMutation({
	args: {
		// Retention period in days (default: 90)
		retentionDays: v.optional(v.number()),
		// Batch size for deletion (default: 100)
		batchSize: v.optional(v.number()),
		// Dry run mode - log what would be deleted without actually deleting
		dryRun: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const retentionDays = args.retentionDays ?? 90;
		const batchSize = args.batchSize ?? 100;
		const dryRun = args.dryRun ?? false;

		// Calculate cutoff date
		const cutoffDate = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

		console.log(
			`[Cron] Cleanup soft-deleted records - Started (retention: ${retentionDays} days, batch size: ${batchSize}, dry run: ${dryRun})`,
		);

		let totalDeleted = 0;

		try {
			// Cleanup soft-deleted chats
			const chatsToDelete = await ctx.db
				.query("chats")
				.filter((q) => q.neq(q.field("deletedAt"), undefined))
				.filter((q) => q.lt(q.field("deletedAt"), cutoffDate))
				.take(batchSize);

			for (const chat of chatsToDelete) {
				if (dryRun) {
					console.log(
						`[Cron] Would delete chat: ${chat._id} (deleted at: ${new Date(chat.deletedAt!).toISOString()})`,
					);
				} else {
					await ctx.db.delete(chat._id);
					// PERFORMANCE OPTIMIZATION: Update stats counters instead of recalculating
					await decrementStat(ctx, STAT_KEYS.CHATS_TOTAL);
					await decrementStat(ctx, STAT_KEYS.CHATS_SOFT_DELETED);
					console.log(
						`[Cron] Hard deleted chat: ${chat._id} (deleted at: ${new Date(chat.deletedAt!).toISOString()})`,
					);
				}
				totalDeleted++;
			}

			// Cleanup soft-deleted messages
			const messagesToDelete = await ctx.db
				.query("messages")
				.filter((q) => q.neq(q.field("deletedAt"), undefined))
				.filter((q) => q.lt(q.field("deletedAt"), cutoffDate))
				.take(batchSize);

			for (const message of messagesToDelete) {
				if (dryRun) {
					console.log(
						`[Cron] Would delete message: ${message._id} (deleted at: ${new Date(message.deletedAt!).toISOString()})`,
					);
				} else {
					await ctx.db.delete(message._id);
					// PERFORMANCE OPTIMIZATION: Update stats counters instead of recalculating
					await decrementStat(ctx, STAT_KEYS.MESSAGES_TOTAL);
					await decrementStat(ctx, STAT_KEYS.MESSAGES_SOFT_DELETED);
					console.log(
						`[Cron] Hard deleted message: ${message._id} (deleted at: ${new Date(message.deletedAt!).toISOString()})`,
					);
				}
				totalDeleted++;
			}

			console.log(
				`[Cron] Cleanup soft-deleted records - Completed (${totalDeleted} records ${dryRun ? "would be" : ""} deleted)`,
			);

			return {
				success: true,
				deleted: totalDeleted,
				dryRun,
				cutoffDate: new Date(cutoffDate).toISOString(),
			};
		} catch (error) {
			console.error("[Cron] Cleanup soft-deleted records - Failed", error);
			throw error;
		}
	},
});

/**
 * Cleanup expired rate limit buckets
 *
 * NOTE: Using @convex-dev/rate-limiter package which handles cleanup automatically.
 * No manual cleanup needed!
 */

/**
 * Generate database statistics
 *
 * Periodic job to collect database statistics for monitoring and alerting.
 * Useful for capacity planning and performance optimization.
 *
 * SCHEDULE RECOMMENDATION:
 * - Run daily at a consistent time
 * - Store results for trend analysis
 *
 * @example
 * ```bash
 * # Configure in Convex dashboard:
 * npx convex crons schedule --name generate-db-stats \
 *   --schedule "0 0 * * *" \
 *   --function crons:generateDatabaseStats
 * ```
 */
export const generateDatabaseStats = internalMutation({
	args: {},
	handler: async (ctx) => {
		console.log("[Cron] Generate database stats - Started");

		try {
			// PERFORMANCE OPTIMIZATION: Read from stats counters instead of full table scans
			// This is O(1) instead of O(n) where n = total records in table
			// Before: Multiple .collect() calls loading all records into memory
			// After: Direct lookup of pre-calculated counters
			const statValues = await getStats(ctx, [
				STAT_KEYS.CHATS_TOTAL,
				STAT_KEYS.CHATS_SOFT_DELETED,
				STAT_KEYS.MESSAGES_TOTAL,
				STAT_KEYS.MESSAGES_SOFT_DELETED,
				STAT_KEYS.USERS_TOTAL,
			]);

			const stats = {
				timestamp: new Date().toISOString(),
				tables: {
					chats: {
						total: statValues[STAT_KEYS.CHATS_TOTAL],
						softDeleted: statValues[STAT_KEYS.CHATS_SOFT_DELETED],
						active: statValues[STAT_KEYS.CHATS_TOTAL] - statValues[STAT_KEYS.CHATS_SOFT_DELETED],
					},
					messages: {
						total: statValues[STAT_KEYS.MESSAGES_TOTAL],
						softDeleted: statValues[STAT_KEYS.MESSAGES_SOFT_DELETED],
						active: statValues[STAT_KEYS.MESSAGES_TOTAL] - statValues[STAT_KEYS.MESSAGES_SOFT_DELETED],
					},
					users: {
						total: statValues[STAT_KEYS.USERS_TOTAL],
					},
				},
			};

			console.log("[Cron] Database statistics:", JSON.stringify(stats, null, 2));

			// TODO: Send alerts if any metrics exceed thresholds

			console.log("[Cron] Generate database stats - Completed");

			return {
				success: true,
				stats,
			};
		} catch (error) {
			console.error("[Cron] Generate database stats - Failed", error);
			throw error;
		}
	},
});
