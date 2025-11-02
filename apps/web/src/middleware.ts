import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Get session cookie
	const sessionCookie = getSessionCookie(request);
	const hasSession = !!sessionCookie;

	// Public routes that don't require authentication
	const publicRoutes = ["/", "/auth/sign-in"];
	const isPublicRoute = publicRoutes.includes(pathname);

	// If user is on sign-in page and has session, redirect to dashboard
	if (pathname === "/auth/sign-in" && hasSession) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	// If user is trying to access protected route without session, redirect to sign-in
	if (!isPublicRoute && !hasSession) {
		return NextResponse.redirect(new URL("/auth/sign-in", request.url));
	}

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
