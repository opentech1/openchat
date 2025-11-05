import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Public routes that don't require authentication
	const publicRoutes = ["/", "/auth/sign-in"];
	const isPublicRoute = publicRoutes.includes(pathname);

	// Skip middleware for public routes and API routes
	if (isPublicRoute || pathname.startsWith("/api/")) {
		return NextResponse.next();
	}

	// For protected routes, check if session cookie exists
	// Note: We only check for cookie EXISTENCE, not validity
	// Actual session validation happens in Server Components
	const sessionToken = request.cookies.get("openchat.session_token");

	console.log("[MIDDLEWARE] Path:", pathname, "| Session cookie:", sessionToken ? "EXISTS" : "MISSING");

	// If no session cookie, redirect to sign-in
	if (!sessionToken) {
		console.log("[MIDDLEWARE] Redirecting to sign-in");
		return NextResponse.redirect(new URL("/auth/sign-in", request.url));
	}

	// Cookie exists, allow through
	// Server Components will validate the actual session
	console.log("[MIDDLEWARE] Allowing access");
	return NextResponse.next();
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
