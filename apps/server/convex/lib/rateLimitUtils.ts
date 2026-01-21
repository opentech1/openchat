/**
 * Shared rate limit utilities for consistent error handling across Convex functions
 */

/**
 * Formats a rate limit wait time for user-friendly display
 * @param retryAfterMs - Time until retry is allowed, in milliseconds
 * @returns A formatted string like "in 5 seconds" or "later"
 */
export function formatWaitTime(retryAfterMs: number | undefined): string {
	if (retryAfterMs !== undefined) {
		return `in ${Math.ceil(retryAfterMs / 1000)} seconds`;
	}
	return "later";
}

/**
 * Creates and throws a rate limit error with a user-friendly message
 * @param action - The action that was rate limited (e.g., "requests", "file uploads")
 * @param retryAfterMs - Optional time until retry is allowed, in milliseconds
 * @throws Error with a formatted rate limit message
 */
export function throwRateLimitError(
	action: string,
	retryAfterMs?: number
): never {
	const waitTime = formatWaitTime(retryAfterMs);
	const error = new Error(`Too many ${action}. Please try again ${waitTime}.`);
	error.name = "RateLimitError";
	throw error;
}
