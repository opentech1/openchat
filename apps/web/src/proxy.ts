import { type NextRequest, NextResponse } from "next/server";
import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

/**
 * Pre-compute CSP headers at module load to eliminate per-request overhead
 *
 * Content Security Policy (CSP) prevents XSS attacks by controlling what resources can be loaded.
 * By computing this once at module load, we save ~0.1-0.3ms per request.
 */
const BASE_CSP_DIRECTIVES = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.convex.cloud https://*.convex.site https://us.i.posthog.com https://us-assets.i.posthog.com https://unpkg.com https://va.vercel-scripts.com https://static.cloudflareinsights.com",
	"connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud wss://*.convex.site https://openrouter.ai https://us.i.posthog.com https://us-assets.i.posthog.com",
	"img-src 'self' blob: data: https://*.convex.cloud https://*.convex.site https://avatar.vercel.sh https://avatars.githubusercontent.com https://models.dev",
	"font-src 'self' data:",
	"style-src 'self' 'unsafe-inline'",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
].join("; ");

const CSP_HEADER_VALUE =
	process.env.NODE_ENV === "production"
		? `${BASE_CSP_DIRECTIVES}; upgrade-insecure-requests`
		: BASE_CSP_DIRECTIVES;

/**
 * Paths that do not require authentication
 * - Landing page
 * - Auth sign-in page
 * - Auth callback routes
 * - Public stats API
 */
const UNAUTHENTICATED_PATHS = [
	"/",
	"/auth/sign-in",
	"/auth/callback",
	"/api/auth/callback",
	"/api/stats",
];

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
 * Apply security headers to a response
 */
function applySecurityHeaders(
	response: NextResponse,
	correlationId: string,
): void {
	// Set correlation ID for request tracing
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

	// Set pre-computed CSP header
	response.headers.set("Content-Security-Policy", CSP_HEADER_VALUE);
}

/**
 * Create the WorkOS AuthKit middleware with proper configuration
 *
 * This handles:
 * - Session management and cookie handling
 * - Automatic redirects to AuthKit for protected routes
 * - Token refresh
 */
const workosMiddleware = authkitMiddleware({
	redirectUri: process.env.WORKOS_REDIRECT_URI,
	middlewareAuth: {
		enabled: true,
		unauthenticatedPaths: UNAUTHENTICATED_PATHS,
	},
});

/**
 * Combined proxy for WorkOS AuthKit authentication and security headers
 *
 * Next.js 16 uses proxy.ts instead of middleware.ts
 *
 * Wraps authkitMiddleware to add:
 * - Request correlation IDs for distributed tracing
 * - Security headers for all responses (CSP, XSS protection, etc.)
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
	// Extract or generate correlation ID
	const existingCorrelationId = request.headers.get("x-request-id");
	const correlationId = existingCorrelationId || generateCorrelationId();

	// Call WorkOS AuthKit middleware first - it handles authentication,
	// session management, and redirects for unauthenticated users
	const authkitResult = await workosMiddleware(request, {} as never);

	// AuthKit middleware returns NextResponse for both redirects and normal requests
	// If no response (void/undefined), create a default NextResponse.next()
	const response =
		authkitResult instanceof NextResponse
			? authkitResult
			: NextResponse.next();

	// Apply security headers to the response
	applySecurityHeaders(response, correlationId);

	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - __webpack_hmr (webpack hot module replacement - dev only)
		 * - favicon.ico, sitemap.xml, robots.txt (public files)
		 * - images and other assets (png, jpg, jpeg, gif, svg, webp, ico)
		 *
		 * Note: API routes are included for auth callback handling
		 */
		"/((?!_next/static|_next/image|__webpack_hmr|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)",
	],
};
