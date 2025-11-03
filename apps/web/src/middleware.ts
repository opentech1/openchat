import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Public routes that don't require authentication
	const publicRoutes = ["/", "/auth/sign-in"];
	const isPublicRoute = publicRoutes.includes(pathname);

	// Get the session cookie directly
	const cookiePrefix = "openchat";
	const sessionCookie = request.cookies.get(`${cookiePrefix}.session-token`);

	// If no session cookie exists and trying to access protected route, redirect to sign-in
	if (!isPublicRoute && !sessionCookie) {
		return NextResponse.redirect(new URL("/auth/sign-in", request.url));
	}

	// If session cookie exists, validate it with the Better Auth session endpoint
	// but only for non-public routes to avoid unnecessary API calls
	if (!isPublicRoute && sessionCookie) {
		const sessionValid = await checkSession(request);

		// If session validation fails, redirect to sign-in
		if (!sessionValid) {
			return NextResponse.redirect(new URL("/auth/sign-in", request.url));
		}
	}

	// If user is on sign-in page and has a session cookie, validate and redirect
	if (pathname === "/auth/sign-in" && sessionCookie) {
		const sessionValid = await checkSession(request);
		if (sessionValid) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}
	}

	return NextResponse.next();
}

async function checkSession(request: NextRequest): Promise<boolean> {
	try {
		// Get the base URL for the API call
		const baseUrl = request.nextUrl.origin;

		// Call the Better Auth get-session endpoint to validate the session
		const response = await fetch(`${baseUrl}/api/auth/get-session`, {
			headers: {
				// Forward all cookies to the session endpoint
				cookie: request.headers.get("cookie") || "",
			},
			cache: "no-store",
		});

		if (!response.ok) {
			console.log("Session validation failed with status:", response.status);
			return false;
		}

		const data = await response.json();
		console.log("Session data:", data?.user ? "User found" : "No user");
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
