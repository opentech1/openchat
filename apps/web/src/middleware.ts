import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Public routes that don't require authentication
	const publicRoutes = ["/", "/auth/sign-in"];
	const isPublicRoute = publicRoutes.includes(pathname);

	// Get session token from cookie
	const sessionToken = request.cookies.get("openchat.session-token")?.value;
	const hasSessionToken = !!sessionToken;

	// For sign-in page: if user has a session token, they might be logged in
	// We'll let the page itself validate and redirect if needed
	if (pathname === "/auth/sign-in" && hasSessionToken) {
		// Validate session to avoid unnecessary redirects
		try {
			const baseUrl = request.nextUrl.origin;
			const response = await fetch(`${baseUrl}/api/auth/session`, {
				headers: {
					cookie: request.headers.get("cookie") || "",
				},
				cache: "no-store",
			});
			if (response.ok) {
				const data = await response.json();
				if (data.user) {
					return NextResponse.redirect(new URL("/dashboard", request.url));
				}
			}
		} catch {
			// If validation fails, let them proceed to sign-in
		}
	}

	// If user is trying to access protected route without session token, redirect to sign-in
	// Server components will do the full validation
	if (!isPublicRoute && !hasSessionToken) {
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
