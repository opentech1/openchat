import { type NextRequest, NextResponse } from "next/server";

/**
 * Pre-compute CSP headers at module load to eliminate per-request overhead
 *
 * Content Security Policy (CSP) prevents XSS attacks by controlling what resources can be loaded.
 * By computing this once at module load, we save ~0.1-0.3ms per request.
 */
const BASE_CSP_DIRECTIVES = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.convex.cloud https://*.convex.site https://us.i.posthog.com https://us-assets.i.posthog.com https://unpkg.com https://va.vercel-scripts.com",
	"connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud wss://*.convex.site https://openrouter.ai https://us.i.posthog.com https://us-assets.i.posthog.com",
	"img-src 'self' blob: data: https://*.convex.cloud https://*.convex.site https://avatar.vercel.sh https://avatars.githubusercontent.com https://models.dev",
	"font-src 'self' data:",
	"style-src 'self' 'unsafe-inline'",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
].join("; ");

const CSP_HEADER_VALUE = process.env.NODE_ENV === "production"
	? `${BASE_CSP_DIRECTIVES}; upgrade-insecure-requests`
	: BASE_CSP_DIRECTIVES;

/**
 * Generate a unique request correlation ID
 *
 * Format: {timestamp}-{random}
 * Example: 1699564231-a3f9c8d2
 *
 * Uses Web Crypto API (edge-compatible) instead of Node.js crypto module
 */
function generateCorrelationId(): string {
	const timestamp = Date.now().toString(36);
	// Use Web Crypto API which is available in Edge Runtime
	const randomArray = new Uint8Array(4);
	crypto.getRandomValues(randomArray);
	const random = Array.from(randomArray)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `${timestamp}-${random}`;
}

/**
 * Middleware for security headers and request tracing
 *
 * Provides:
 * - Request correlation IDs for distributed tracing
 * - Security headers for all responses (CSP, XSS protection, etc.)
 *
 * NOTE: Authentication is NOT handled here. The convexClient() plugin from
 * @convex-dev/better-auth stores sessions in localStorage (not cookies) for
 * cross-domain compatibility with Convex. Middleware cannot access localStorage,
 * so auth checks happen in server components via getUserContext().
 *
 * REQUEST CORRELATION IDS:
 * - Each request gets a unique X-Request-ID header
 * - If client provides one, we use it (for client-side correlation)
 * - Otherwise, we generate a new one
 * - This ID should be logged with all operations for that request
 * - Makes it easy to trace a request through multiple services/logs
 */
export async function middleware(request: NextRequest) {
	// Extract or generate correlation ID
	const existingCorrelationId = request.headers.get("x-request-id");
	const correlationId = existingCorrelationId || generateCorrelationId();

	// NOTE: Authentication is handled by server components via getUserContext()
	// We don't check for cookies here because convexClient() from @convex-dev/better-auth
	// stores session in localStorage (not browser cookies) for cross-domain compatibility.
	// The middleware cannot access localStorage, so auth checks happen server-side.

	// Add security headers to all responses
	const response = NextResponse.next();

	// Set correlation ID for request tracing
	// This allows logs to be correlated across services
	response.headers.set("X-Request-ID", correlationId);

	// Prevent clickjacking attacks
	response.headers.set("X-Frame-Options", "DENY");

	// Prevent MIME type sniffing
	response.headers.set("X-Content-Type-Options", "nosniff");

	// Enable XSS protection (legacy browsers)
	response.headers.set("X-XSS-Protection", "1; mode=block");

	// Referrer policy for privacy
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

	// Permissions policy (restrict dangerous features)
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), interest-cohort=()",
	);

	// Set pre-computed CSP header (computed at module load for performance)
	response.headers.set("Content-Security-Policy", CSP_HEADER_VALUE);

	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - api routes (handled by API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - __webpack_hmr (webpack hot module replacement - dev only)
		 * - favicon.ico, sitemap.xml, robots.txt (public files)
		 * - images and other assets (png, jpg, svg, etc.)
		 */
		"/((?!api|_next/static|_next/image|__webpack_hmr|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)",
	],
};

