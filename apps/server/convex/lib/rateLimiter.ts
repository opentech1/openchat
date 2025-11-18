/**
 * Rate Limiter Configuration
 *
 * Using @convex-dev/rate-limiter for simple, effective rate limiting.
 *
 * Algorithms:
 * - Fixed Window: Simple count per time period
 * - Token Bucket: Allows bursts, refills over time
 */

import { RateLimiter, SECOND, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Global rate limiter instance
 *
 * Rate limits:
 * - Chat creation: 20 per minute with bursts of 5
 * - Chat deletion: 15 per minute (prevent delete spam)
 * - Message sending: 30 per minute with bursts of 10
 * - File uploads: 10 per minute with bursts of 3
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
	// Chat operations
	chatCreate: {
		kind: "token bucket",
		rate: 20,
		period: MINUTE,
		capacity: 5, // Allow 5 rapid creates if they haven't used many
	},
	chatDelete: {
		kind: "token bucket",
		rate: 15,
		period: MINUTE,
		capacity: 3,
	},

	// Message operations
	messageSend: {
		kind: "token bucket",
		rate: 30,
		period: MINUTE,
		capacity: 10, // Allow conversation bursts
	},

	// File operations
	fileUpload: {
		kind: "token bucket",
		rate: 10,
		period: MINUTE,
		capacity: 3,
	},

	// Aggressive limits for detected spammers
	spammerBlock: {
		kind: "fixed window",
		rate: 1,
		period: HOUR, // Only 1 action per hour if flagged as spammer
	},
});
