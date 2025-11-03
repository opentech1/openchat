import { type NextRequest, NextResponse } from "next/server";
import { fetchSession } from "@/lib/auth-server";

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Public routes that don't require authentication
	const publicRoutes = ["/", "/auth/sign-in"];
	const isPublicRoute = publicRoutes.includes(pathname);

	// Get session token from cookie
	const sessionToken = request.cookies.get("openchat.session-token")?.value;
	
	// Check session using the shared cached function
	// This ensures we don't duplicate the fetch when server components also check
	const sessionValid = sessionToken ? !!(await fetchSession(sessionToken))?.user : false;

	// If user is on sign-in page and has valid session, redirect to dashboard
	if (pathname === "/auth/sign-in" && sessionValid) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	// If user is trying to access protected route without valid session, redirect to sign-in
	if (!isPublicRoute && !sessionValid) {
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
