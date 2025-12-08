/**
 * Public Stats API
 *
 * Provides public statistics for the application (sign-in page, landing page, etc.)
 */

import { query } from "./_generated/server";
import { getStats, STAT_KEYS } from "./lib/dbStats";

/**
 * Get public stats for display on the website
 * This is a public query - no auth required
 */
export const getPublicStats = query({
	args: {},
	handler: async (ctx) => {
		const statValues = await getStats(ctx, [
			STAT_KEYS.MESSAGES_TOTAL,
			STAT_KEYS.USERS_TOTAL,
			STAT_KEYS.CHATS_TOTAL,
		]);

		// Get GitHub stars from dbStats (can be updated via cron)
		const starsStat = await ctx.db
			.query("dbStats")
			.withIndex("by_key", (q) => q.eq("key", "github_stars"))
			.unique();

		return {
			messages: statValues[STAT_KEYS.MESSAGES_TOTAL] || 0,
			users: statValues[STAT_KEYS.USERS_TOTAL] || 0,
			chats: statValues[STAT_KEYS.CHATS_TOTAL] || 0,
			stars: starsStat?.value || 0,
			models: 200, // Static - OpenRouter has 200+ models
		};
	},
});
