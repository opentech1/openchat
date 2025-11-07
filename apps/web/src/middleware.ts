import { type NextRequest, NextResponse } from "next/server";

/**
 * Middleware for route-level protection
 *
 * Provides:
 * - Authentication checks for protected routes
 * - Security headers for all responses
 */
export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

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

