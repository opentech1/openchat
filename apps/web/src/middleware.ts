import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Public routes that don't require authentication
	const publicRoutes = ["/", "/auth/sign-in"];
	const isPublicRoute = publicRoutes.includes(pathname);

	// Check session by calling the Better Auth session endpoint
	// This properly validates the session (not just cookie existence)
	const sessionValid = await checkSession(request);

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

async function checkSession(request: NextRequest): Promise<boolean> {
	try {
		// Get the base URL for the API call
		const baseUrl = request.nextUrl.origin;

		// Call the Better Auth session endpoint to validate the session
		const response = await fetch(`${baseUrl}/api/auth/session`, {
			headers: {
				// Forward all cookies to the session endpoint
				cookie: request.headers.get("cookie") || "",
			},
			cache: "no-store",
		});

		if (!response.ok) {
			return false;
		}

		const data = await response.json();
		// Session is valid if it has a user
		return !!data.user;
	} catch (error) {
		// If session check fails, treat as invalid session
		console.error("Session validation error:", error);
		return false;
	}
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
