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

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

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
 * If you're using a database-backed rate limiter (instead of in-memory),
 * this job cleans up expired rate limit records to prevent table bloat.
 *
 * NOTE: The current implementation uses in-memory rate limiting, so this
 * is a placeholder for future enhancement.
 *
 * SCHEDULE RECOMMENDATION:
 * - Run every hour
 * - Quick operation, minimal database load
 *
 * @example
 * ```bash
 * # Configure in Convex dashboard:
 * npx convex crons schedule --name cleanup-rate-limits \
 *   --schedule "0 * * * *" \
 *   --function crons:cleanupExpiredRateLimits
 * ```
 */
export const cleanupExpiredRateLimits = internalMutation({
	args: {},
	handler: async (ctx) => {
		console.log("[Cron] Cleanup expired rate limits - Started");

		// TODO: Implement when rate limiting moves to database
		// Current implementation uses in-memory buckets with automatic cleanup

		console.log("[Cron] Cleanup expired rate limits - Skipped (in-memory implementation)");

		return {
			success: true,
			message: "In-memory rate limiter handles cleanup automatically",
		};
	},
});

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
			// Count records in each table
			const chatsCount = await ctx.db.query("chats").collect().then((c) => c.length);
			const messagesCount = await ctx.db.query("messages").collect().then((m) => m.length);
			const usersCount = await ctx.db.query("users").collect().then((u) => u.length);

			// Count soft-deleted records
			const softDeletedChats = await ctx.db
				.query("chats")
				.filter((q) => q.neq(q.field("deletedAt"), undefined))
				.collect()
				.then((c) => c.length);

			const softDeletedMessages = await ctx.db
				.query("messages")
				.filter((q) => q.neq(q.field("deletedAt"), undefined))
				.collect()
				.then((m) => m.length);

			const stats = {
				timestamp: new Date().toISOString(),
				tables: {
					chats: {
						total: chatsCount,
						softDeleted: softDeletedChats,
						active: chatsCount - softDeletedChats,
					},
					messages: {
						total: messagesCount,
						softDeleted: softDeletedMessages,
						active: messagesCount - softDeletedMessages,
					},
					users: {
						total: usersCount,
					},
				},
			};

			console.log("[Cron] Database statistics:", JSON.stringify(stats, null, 2));

			// TODO: Store stats in a separate table for trend analysis
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
