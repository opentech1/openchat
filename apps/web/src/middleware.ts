import { type NextRequest, NextResponse } from "next/server";

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
 * Middleware for route-level protection
 *
 * Provides:
 * - Request correlation IDs for distributed tracing
 * - Authentication checks for protected routes
 * - Security headers for all responses
 *
 * REQUEST CORRELATION IDS:
 * - Each request gets a unique X-Request-ID header
 * - If client provides one, we use it (for client-side correlation)
 * - Otherwise, we generate a new one
 * - This ID should be logged with all operations for that request
 * - Makes it easy to trace a request through multiple services/logs
 */
export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Extract or generate correlation ID
	const existingCorrelationId = request.headers.get("x-request-id");
	const correlationId = existingCorrelationId || generateCorrelationId();

	// Protected routes that require authentication
	const protectedRoutes = ["/dashboard", "/chat", "/settings"];
	const isProtectedRoute = protectedRoutes.some((route) =>
		pathname.startsWith(route),
	);

	if (isProtectedRoute) {
		// Check for session cookie
		// better-auth stores session token with cookiePrefix from convex/auth.ts
		// In production (HTTPS): "__Secure-openchat.session_token"
		// In development (HTTP): "openchat.session_token"
		const secureCookie = request.cookies.get("__Secure-openchat.session_token");
		const normalCookie = request.cookies.get("openchat.session_token");
		const hasSession = secureCookie || normalCookie;

		if (!hasSession) {
			// Redirect to sign-in if no session found
			const signInUrl = new URL("/auth/sign-in", request.url);
			signInUrl.searchParams.set("from", pathname);
			return NextResponse.redirect(signInUrl);
		}

		// Note: We only check for session cookie existence here
		// Full session validation happens in getUserContext() server-side
		// This is by design - middleware is edge-compatible and shouldn't make
		// external API calls. The actual auth verification happens in server components.
	}

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

	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - api routes (handled by API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (public files)
		 * - images and other assets (png, jpg, svg, etc.)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)",
	],
};

