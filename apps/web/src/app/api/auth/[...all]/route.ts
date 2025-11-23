import { nextJsHandler } from "@convex-dev/better-auth/nextjs";
import { NextResponse } from "next/server";
import { RateLimiter, getClientIp, createRateLimitHeaders } from "@/lib/rate-limit";
import { logWarn } from "@/lib/logger-server";
import { splitCookiesString } from "set-cookie-parser";

/**
 * Convex Better Auth handler for Next.js
 *
 * This route handler proxies auth requests to Convex.
 * Since it runs on the same domain as the app, regular cookies work fine.
 *
 * IMPORTANT: HTTP actions are served from .convex.site, not .convex.cloud
 */
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

	// Add rate limit headers to successful responses
	const rateLimitHeaders = createRateLimitHeaders(result, {
		limit: authRateLimiter.getStats().config.limit,
		windowMs: authRateLimiter.getStats().config.windowMs,
	});

	// Create a new response with rate limit headers
	// IMPORTANT: Manually copy headers to preserve Set-Cookie properly
	// Edge runtime's Headers constructor may not preserve multiple Set-Cookie values
	const newHeaders = new Headers();

	// Copy all non-Set-Cookie headers first
	response.headers.forEach((value, key) => {
		if (key.toLowerCase() !== "set-cookie") {
			newHeaders.append(key, value);
		}
	});

	// Preserve Set-Cookie headers using getSetCookie() if available,
	// or fall back to parsing the comma-separated value from get()
	let setCookieHeaders: string[] = [];
	if (typeof response.headers.getSetCookie === "function") {
		setCookieHeaders = response.headers.getSetCookie();
	} else {
		// Fallback: get the comma-separated value and split properly
		const setCookieValue = response.headers.get("Set-Cookie");
		if (setCookieValue) {
			setCookieHeaders = splitCookiesString(setCookieValue);
		}
	}

	// Add rate limit headers
	Object.entries(rateLimitHeaders).forEach(([key, value]) => {
		newHeaders.set(key, value);
	});

	// Add Set-Cookie headers individually (not comma-joined)
	// IMPORTANT: Sanitize cookies to ensure they work with our domain
	// Convex runs on .convex.site but our app runs on osschat.dev
	// We need to strip the Domain attribute to let the browser set it for our domain
	for (const cookie of setCookieHeaders) {
		let sanitizedCookie = cookie;

		// Strip Domain attribute - if it's set to .convex.site, it won't work for our domain
		sanitizedCookie = sanitizedCookie.replace(/;\s*[Dd]omain=[^;]+/g, "");

		// In development, strip Secure attribute so cookies work on HTTP localhost
		if (process.env.NODE_ENV !== "production") {
			sanitizedCookie = sanitizedCookie.replace(/;\s*[Ss]ecure/g, "");
			// Also strip __Secure- prefix from cookie name if present
			sanitizedCookie = sanitizedCookie.replace(/^__Secure-/i, "");
		}

		newHeaders.append("Set-Cookie", sanitizedCookie);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}

export const GET = (req: Request) => withAuthRateLimit(req, originalGET);
export const POST = (req: Request) => withAuthRateLimit(req, originalPOST);
