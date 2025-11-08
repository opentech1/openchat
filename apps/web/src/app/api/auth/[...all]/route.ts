import { nextJsHandler } from "@convex-dev/better-auth/nextjs";
import { NextResponse } from "next/server";
import { RateLimiter, getClientIp, createRateLimitHeaders } from "@/lib/rate-limit";
import { logWarn } from "@/lib/logger-server";

// Export the Convex Better Auth handler for Next.js
// This uses Convex as the database backend instead of SQLite
// Sessions and user data are stored in Convex
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "https://outgoing-setter-201.convex.site";
const { GET: originalGET, POST: originalPOST } = nextJsHandler({ convexSiteUrl });

// Rate limiter for auth endpoints to prevent brute force attacks
// More restrictive than general API endpoints
const authRateLimiter = new RateLimiter({
	limit: parseInt(process.env.AUTH_RATE_LIMIT ?? "10", 10), // 10 requests
	windowMs: parseInt(process.env.AUTH_RATE_WINDOW_MS ?? "60000", 10), // per minute
	maxBuckets: 5000,
});

/**
 * Wrap auth handler with rate limiting
 * Prevents brute force attacks on authentication endpoints
 */
async function withAuthRateLimit(
	request: Request,
	handler: (request: Request) => Promise<Response>,
): Promise<Response> {
	const clientIp = getClientIp(request);
	const result = authRateLimiter.check(clientIp);

	if (result.limited) {
		logWarn(`Auth rate limit exceeded for IP: ${clientIp.substring(0, 8)}...`);

		const headers = createRateLimitHeaders(result, {
			limit: authRateLimiter.getStats().config.limit,
			windowMs: authRateLimiter.getStats().config.windowMs,
		});

		return NextResponse.json(
			{
				error: "Too many authentication attempts",
				message: "Please try again later",
			},
			{
				status: 429,
				headers,
			},
		);
	}

	// Call the original handler
	const response = await handler(request);

	// Add rate limit headers to successful responses too
	const rateLimitHeaders = createRateLimitHeaders(result, {
		limit: authRateLimiter.getStats().config.limit,
		windowMs: authRateLimiter.getStats().config.windowMs,
	});

	Object.entries(rateLimitHeaders).forEach(([key, value]) => {
		response.headers.set(key, value);
	});

	return response;
}

// Export wrapped handlers with rate limiting
export async function GET(request: Request) {
	return withAuthRateLimit(request, originalGET);
}

export async function POST(request: Request) {
	return withAuthRateLimit(request, originalPOST);
}
