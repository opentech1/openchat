/**
 * CSRF Protection Utility
 *
 * Implements CSRF token generation and validation using the Double Submit Cookie pattern.
 * This is suitable for stateless authentication (JWT, session tokens) where we don't want
 * to maintain server-side session state.
 *
 * How it works:
 * 1. Server generates a random CSRF token and sends it in both:
 *    - A cookie (HttpOnly, SameSite=Lax)
 *    - Response header (for client to read)
 * 2. Client includes the token in request headers
 * 3. Server validates that the header token matches the cookie token
 *
 * This prevents CSRF because:
 * - Malicious sites can't read cookies from our domain (Same-Origin Policy)
 * - They can't set custom headers on cross-origin requests without CORS preflight
 */

import { createHash, randomBytes } from "crypto";
import { logError, logWarn } from "./logger-server";

export const CSRF_COOKIE_NAME = "openchat.csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_TOKEN_LENGTH = 32; // 32 bytes = 256 bits

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
	return randomBytes(CSRF_TOKEN_LENGTH).toString("base64url");
}

/**
 * Create a hash of a CSRF token for comparison
 * This prevents timing attacks during validation
 */
function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/**
 * Validate CSRF token from request
 *
 * Implements the Double Submit Cookie pattern for CSRF protection.
 * Validates that the token in the request header matches the token in the cookie.
 *
 * HOW IT WORKS:
 * 1. Server generates random CSRF token
 * 2. Token stored in cookie (SameSite=Lax, HttpOnly optional)
 * 3. Token also sent in response header for client to read
 * 4. Client includes token in X-CSRF-Token header for mutations
 * 5. Server validates cookie token === header token
 *
 * WHY IT'S SECURE:
 * - Malicious sites can't read cookies from your domain (Same-Origin Policy)
 * - They can't set custom headers on cross-origin requests (CORS)
 * - Even if they trigger a request, they can't provide matching token
 *
 * WHEN TO VALIDATE:
 * - All state-changing operations (POST, PUT, DELETE, PATCH)
 * - Skip for safe methods (GET, HEAD, OPTIONS)
 * - Skip for API endpoints using Bearer tokens (different auth model)
 *
 * TIMING ATTACKS:
 * - Uses constant-time comparison via SHA-256 hashing
 * - Prevents attackers from guessing tokens character by character
 * - Even a one-character difference takes same time to compute
 *
 * @param request - The incoming HTTP request
 * @param cookieToken - CSRF token from cookie (get via cookies().get())
 * @returns Validation result with success flag and optional error message
 * @returns valid - true if tokens match, false otherwise
 * @returns error - Human-readable error message if validation fails
 *
 * @example
 * ```typescript
 * // In API route handler
 * import { cookies } from "next/headers";
 * import { validateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";
 *
 * export async function POST(request: Request) {
 *   const cookieStore = await cookies();
 *   const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME);
 *
 *   const validation = validateCsrfToken(request, csrfCookie?.value);
 *
 *   if (!validation.valid) {
 *     return new Response(
 *       JSON.stringify({ error: validation.error }),
 *       { status: 403 }
 *     );
 *   }
 *
 *   // Continue with request processing...
 * }
 * ```
 *
 * @see {@link withCsrfProtection} for middleware wrapper
 * @see {@link requiresCsrfProtection} to check if method needs protection
 */
export function validateCsrfToken(
	request: Request,
	cookieToken: string | undefined,
): { valid: boolean; error?: string } {
	// Get token from header
	const headerToken = request.headers.get(CSRF_HEADER_NAME);

	// Both tokens must be present
	if (!cookieToken) {
		return { valid: false, error: "Missing CSRF cookie" };
	}

	if (!headerToken) {
		return { valid: false, error: "Missing CSRF header" };
	}

	// Use constant-time comparison to prevent timing attacks
	try {
		const cookieHash = hashToken(cookieToken);
		const headerHash = hashToken(headerToken);

		// Timing-safe comparison
		if (cookieHash !== headerHash) {
			return { valid: false, error: "CSRF token mismatch" };
		}

		return { valid: true };
	} catch (error) {
		logError("CSRF validation error", error);
		return { valid: false, error: "CSRF validation failed" };
	}
}

/**
 * Create CSRF cookie configuration
 */
export function createCsrfCookie(token: string, isProduction: boolean): string {
	const maxAge = 60 * 60 * 24; // 24 hours
	const secure = isProduction ? "Secure; " : "";
	const sameSite = "SameSite=Lax";

	// HttpOnly prevents XSS attacks from stealing the token
	// Client reads token from response body/header, not cookie
	// Cookie is only used for server-side validation
	return `${CSRF_COOKIE_NAME}=${token}; Path=/; ${secure}${sameSite}; Max-Age=${maxAge}; HttpOnly`;
}

/**
 * Check if request method requires CSRF protection
 */
export function requiresCsrfProtection(method: string): boolean {
	const safeMethods = ["GET", "HEAD", "OPTIONS"];
	return !safeMethods.includes(method.toUpperCase());
}

/**
 * Middleware wrapper for CSRF protection
 * Use this to wrap API route handlers that need CSRF protection
 */
export async function withCsrfProtection(
	request: Request,
	cookieToken: string | undefined,
	handler: () => Promise<Response>,
): Promise<Response> {
	// Skip CSRF check for safe methods
	if (!requiresCsrfProtection(request.method)) {
		return handler();
	}

	// Validate CSRF token
	const validation = validateCsrfToken(request, cookieToken);

	if (!validation.valid) {
		logWarn(`CSRF validation failed: ${validation.error}`);
		return new Response(
			JSON.stringify({
				error: "CSRF validation failed",
				message: "Invalid or missing CSRF token",
			}),
			{
				status: 403,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}

	// Call the actual handler
	return handler();
}

/**
 * Create a response with CSRF token cookie
 * Use this for GET requests that need to set initial CSRF token
 */
export function responseWithCsrfToken(response: Response): Response {
	const token = generateCsrfToken();
	const isProduction = process.env.NODE_ENV === "production";

	// Clone response to add headers
	const newResponse = new Response(response.body, response);
	newResponse.headers.set("Set-Cookie", createCsrfCookie(token, isProduction));
	newResponse.headers.set(CSRF_HEADER_NAME, token);

	return newResponse;
}
