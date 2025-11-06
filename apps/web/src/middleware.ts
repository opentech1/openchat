import { type NextRequest, NextResponse } from "next/server";

/**
 * Get the trusted base URL for internal API calls.
 * This prevents SSRF attacks by not trusting user-provided origin values.
 */
function getTrustedBaseUrl(): string {
	// In production, use the configured app URL
	// In development, default to localhost
	return (
		process.env.NEXT_PUBLIC_APP_URL ||
		process.env.NEXT_PUBLIC_SITE_URL ||
		process.env.NEXT_PUBLIC_BASE_URL ||
		(process.env.NODE_ENV === "production"
			? "" // Production should always have an env var set
			: "http://localhost:3001")
	);
}

/**
 * Validates that a URL origin matches the trusted base URL.
 * This is used to prevent SSRF attacks.
 */
function isValidOrigin(urlString: string, trustedBaseUrl: string): boolean {
	try {
		const url = new URL(urlString);
		const trustedUrl = new URL(trustedBaseUrl);
		return url.origin === trustedUrl.origin;
	} catch {
		return false;
	}
}

export async function middleware(request: NextRequest) {
	// Let all requests through - auth is handled by ConvexBetterAuthProvider
	// and useSession() hook in components
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

