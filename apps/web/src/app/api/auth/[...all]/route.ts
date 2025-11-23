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

// TEMPORARILY BYPASS RATE LIMITING TO DEBUG COOKIE ISSUE
// But we MUST wrap the handler to fix the cross-domain cookie issue
const handleAuthRequest = async (request: Request, handler: (request: Request) => Promise<Response>) => {
  const response = await handler(request);

  // Create new headers to modify them
  const newHeaders = new Headers();
  
  // Copy all headers manually to ensure nothing is lost
  response.headers.forEach((value, key) => {
    newHeaders.append(key, value);
  });

  // The crossDomain plugin on Convex server converts Set-Cookie to Set-Better-Auth-Cookie
  // to avoid browser domain mismatch issues when calling directly.
  // Since we are proxying via Next.js (same origin), we need to convert it back to Set-Cookie
  // so the browser will accept it.
  const betterAuthCookie = response.headers.get("Set-Better-Auth-Cookie");
  
  if (betterAuthCookie) {
    // Add it as a standard Set-Cookie header
    // IMPORTANT: We must strip any Domain attribute because:
    // 1. If it's .convex.site, it's invalid for osschat.dev
    // 2. If it's osschat.dev, it was invalid when sent from convex.site (but we are proxying so it's fine now)
    // 3. Safest is to strip it and let it be host-only for osschat.dev
    const sanitizedCookie = betterAuthCookie.replace(/;\s*[Dd]omain=[^;]+/, "");
    newHeaders.append("Set-Cookie", sanitizedCookie);
    // Remove the custom header to clean up
    newHeaders.delete("Set-Better-Auth-Cookie");
  }

  // Also preserve any existing Set-Cookie headers properly
  const existingCookies = response.headers.getSetCookie?.() ?? [];
  // We don't need to re-append if we simply cloned the headers, BUT
  // the Headers constructor implementation can sometimes merge or lose Set-Cookie values
  // so it's safer to be explicit if we were reconstructing from scratch.
  // Since we used new Headers(response.headers), it *should* copy them,
  // but Set-Better-Auth-Cookie logic above is the critical fix.

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};

export const GET = (req: Request) => handleAuthRequest(req, originalGET);
export const POST = (req: Request) => handleAuthRequest(req, originalPOST);
