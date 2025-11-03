import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Public routes that don't require authentication
	// Include auth callback routes to allow OAuth flow to complete
	const publicRoutes = ["/", "/auth/sign-in"];
	const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith("/api/auth");

	// Check if user has any cookies (quick check to avoid API call for completely new visitors)
	const hasCookies = request.cookies.size > 0;

	// For protected routes without any cookies, redirect immediately
	if (!isPublicRoute && !hasCookies) {
		return NextResponse.redirect(new URL("/auth/sign-in", request.url));
	}

	// Only validate session when we have cookies
	if (hasCookies) {
		const sessionValid = await checkSession(request);

		// If on sign-in page with valid session, redirect to dashboard
		if (pathname === "/auth/sign-in" && sessionValid) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}

		// If on protected route with invalid session, redirect to sign-in
		if (!isPublicRoute && !sessionValid) {
			return NextResponse.redirect(new URL("/auth/sign-in", request.url));
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
			if (process.env.NODE_ENV !== "production") {
				console.log("Session validation failed with status:", response.status);
			}
			return false;
		}

		const data = await response.json();
		if (process.env.NODE_ENV !== "production") {
			console.log("Session data:", data?.user ? "User found" : "No user");
		}
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
