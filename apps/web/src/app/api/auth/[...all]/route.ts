import { nextJsHandler } from "@convex-dev/better-auth/nextjs";
import { NextResponse } from "next/server";
import { RateLimiter, getClientIp, createRateLimitHeaders } from "@/lib/rate-limit";
import { logWarn } from "@/lib/logger-server";

// Export the Convex Better Auth handler for Next.js
// This uses Convex as the database backend instead of SQLite
// Sessions and user data are stored in Convex
// IMPORTANT: HTTP actions are served from .convex.site, not .convex.cloud
// Auto-detect from NEXT_PUBLIC_CONVEX_SITE_URL with fallback to production
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
const { GET: originalGET, POST: originalPOST } = nextJsHandler(
	convexSiteUrl ? { convexSiteUrl } : undefined
);

// Rate limiter for auth endpoints to prevent brute force attacks
// More restrictive in production, generous in development for smooth UX
const isDev = process.env.NODE_ENV === "development";
const authRateLimiter = new RateLimiter({
	limit: parseInt(
		process.env.AUTH_RATE_LIMIT ?? (isDev ? "1000" : "30"), // 1000 in dev, 30 in prod
		10
	),
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

	// Create a new response with rate limit headers
	// (Response headers are immutable in Next.js App Router)
	// Clone the response to read it and create a new one with additional headers
	const cloned = response.clone();
	const bodyBuffer = cloned.body ? await cloned.arrayBuffer() : null;
	const newHeaders = new Headers(response.headers);
	Object.entries(rateLimitHeaders).forEach(([key, value]) => {
		newHeaders.set(key, value);
	});

	return new Response(bodyBuffer, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}

// Export wrapped handlers with rate limiting
export async function GET(request: Request) {
	try {
		return await withAuthRateLimit(request, originalGET);
	} catch (error) {
		console.error("[Auth Route Error]", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				// Only include detailed error info in development for security
				// Stack traces can reveal internal implementation details to attackers
				message: isDev && error instanceof Error ? error.message : "An unexpected error occurred",
				...(isDev && error instanceof Error && { stack: error.stack }),
			},
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	try {
		return await withAuthRateLimit(request, originalPOST);
	} catch (error) {
		console.error("[Auth Route Error]", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				// Only include detailed error info in development for security
				// Stack traces can reveal internal implementation details to attackers
				message: isDev && error instanceof Error ? error.message : "An unexpected error occurred",
				...(isDev && error instanceof Error && { stack: error.stack }),
			},
			{ status: 500 },
		);
	}
}
