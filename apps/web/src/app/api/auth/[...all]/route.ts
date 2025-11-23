import { nextJsHandler } from "@convex-dev/better-auth/nextjs";
import { NextResponse } from "next/server";
import { RateLimiter, getClientIp, createRateLimitHeaders } from "@/lib/rate-limit";
import { logWarn } from "@/lib/logger-server";
import { splitCookiesString } from "set-cookie-parser";

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
	// IMPORTANT: Use getSetCookie() to properly preserve Set-Cookie headers
	// The Headers constructor does NOT properly clone multiple Set-Cookie values
	const newHeaders = new Headers(response.headers);

	// Preserve Set-Cookie headers which are critical for auth
	// getSetCookie() returns an array of all Set-Cookie header values
	const setCookieHeaders = response.headers.getSetCookie?.() ?? [];

	// Add rate limit headers
	Object.entries(rateLimitHeaders).forEach(([key, value]) => {
		newHeaders.set(key, value);
	});

	// Re-add Set-Cookie headers that may have been lost during cloning
	for (const cookie of setCookieHeaders) {
		newHeaders.append("Set-Cookie", cookie);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}

/**
 * Handle cross-domain cookie conversion for better-auth
 *
 * The crossDomain plugin on Convex server converts Set-Cookie to Set-Better-Auth-Cookie
 * to avoid browser domain mismatch issues when calling Convex directly.
 * Since we are proxying via Next.js (same origin), we convert it back to Set-Cookie
 * so the browser will accept it for navigation requests.
 *
 * IMPORTANT: We keep BOTH headers because:
 * - Set-Cookie: Used by browser for navigation/page loads
 * - Set-Better-Auth-Cookie: Read by crossDomainClient plugin for localStorage storage
 */
function convertCrossdomainCookies(response: Response): Headers {
	const newHeaders = new Headers();

	// Copy all headers manually to ensure nothing is lost
	response.headers.forEach((value, key) => {
		newHeaders.append(key, value);
	});

	const betterAuthCookieHeader = response.headers.get("Set-Better-Auth-Cookie");

	if (betterAuthCookieHeader) {
		// Set-Better-Auth-Cookie might contain multiple cookies joined by comma
		// We need to split them properly to handle each one
		const cookies = splitCookiesString(betterAuthCookieHeader);

		for (const cookie of cookies) {
			// Strip Domain attribute - if it's .convex.site, it's invalid for our domain
			let sanitizedCookie = cookie.replace(/;\s*[Dd]omain=[^;]+/, "");

			// In development, strip Secure attribute so cookies work on HTTP localhost
			if (process.env.NODE_ENV !== "production") {
				sanitizedCookie = sanitizedCookie.replace(/;\s*[Ss]ecure/g, "");
				// Also strip __Secure- prefix from cookie name if present
				sanitizedCookie = sanitizedCookie.replace(/^__Secure-/i, "");
			}

			newHeaders.append("Set-Cookie", sanitizedCookie);
		}
		// DO NOT delete Set-Better-Auth-Cookie - crossDomainClient needs it!
	}

	return newHeaders;
}

export const GET = (req: Request) =>
	withAuthRateLimit(req, async (request) => {
		const response = await originalGET(request);
		const headers = convertCrossdomainCookies(response);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	});

export const POST = (req: Request) =>
	withAuthRateLimit(req, async (request) => {
		const response = await originalPOST(request);
		const headers = convertCrossdomainCookies(response);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	});
