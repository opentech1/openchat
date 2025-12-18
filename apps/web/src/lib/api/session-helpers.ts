/**
 * Session Token Retrieval Helpers
 *
 * Centralized utilities for retrieving Better Auth session tokens from cookies.
 * This prevents security divergence from multiple implementations.
 *
 * SECURITY: Session token retrieval must be consistent across the app:
 * - Prevents timing attacks through consistent error handling
 * - Ensures proper fallback between secure/normal cookies
 * - Maintains consistent session validation behavior
 *
 * Better Auth Session Storage:
 * - Production (HTTPS): "__Secure-better-auth.session_token" (with __Secure- prefix)
 * - Development (HTTP): "better-auth.session_token" (no prefix)
 */

import { cookies } from "next/headers";

/**
 * Session token cookie names
 * These match the Better Auth default cookie names
 */
export const SECURE_SESSION_COOKIE_NAME = "__Secure-better-auth.session_token";
export const NORMAL_SESSION_COOKIE_NAME = "better-auth.session_token";

/**
 * Get the session token from cookies.
 *
 * IMPORTANT: This only retrieves the token - it does NOT validate it.
 * Validation happens in getUserContext() or via Better Auth.
 *
 * Cookie Priority:
 * 1. Check for secure cookie first (production HTTPS)
 * 2. Fall back to normal cookie (development HTTP)
 * 3. Return undefined if neither exists
 *
 * Use Cases:
 * - Rate limiting before authentication (prevent timing attacks)
 * - Middleware authentication checks
 * - Passing tokens to Convex client
 * - Any operation that needs session token before full validation
 *
 * @returns Session token string if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // In API route - rate limit before auth to prevent timing attacks
 * const sessionToken = await getSessionToken();
 * const rateLimitKey = sessionToken ?? "anonymous";
 * const limited = await rateLimiter.check(rateLimitKey);
 *
 * if (limited) {
 *   return new Response("Rate limited", { status: 429 });
 * }
 *
 * // Now validate user (after rate limit check)
 * const user = await getUserContext();
 * ```
 *
 * @example
 * ```typescript
 * // In middleware - check for session existence
 * const token = await getSessionToken();
 * if (!token) {
 *   return NextResponse.redirect("/auth/sign-in");
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Passing to Convex client
 * const token = await getSessionToken();
 * return NextResponse.json({ token: token ?? null });
 * ```
 */
export async function getSessionToken(): Promise<string | undefined> {
	const cookieStore = await cookies();

	// Check for secure cookie (production HTTPS) first
	const secureCookie = cookieStore.get(SECURE_SESSION_COOKIE_NAME);
	if (secureCookie?.value) {
		return secureCookie.value;
	}

	// Fall back to normal cookie (development HTTP)
	const normalCookie = cookieStore.get(NORMAL_SESSION_COOKIE_NAME);
	if (normalCookie?.value) {
		return normalCookie.value;
	}

	// No session found
	return undefined;
}

/**
 * Get the session token for rate limiting purposes.
 *
 * This is a specialized variant that returns "anonymous" if no token is found,
 * making it convenient for rate limiting scenarios where you need a key.
 *
 * SECURITY: Using session tokens for rate limiting prevents user enumeration
 * through timing attacks. Anonymous users are rate limited together.
 *
 * @returns Session token or "anonymous" if not found
 *
 * @example
 * ```typescript
 * // In API route - simple rate limiting
 * const rateLimitKey = await getSessionTokenForRateLimit();
 * const limited = await rateLimiter.check(rateLimitKey);
 * ```
 */
export async function getSessionTokenForRateLimit(): Promise<string> {
	const token = await getSessionToken();
	return token ?? "anonymous";
}

/**
 * Check if a session token exists in cookies.
 *
 * This is useful for lightweight checks in middleware or edge runtime
 * where you only need to know if a session exists, not validate it.
 *
 * IMPORTANT: This does NOT validate the session - only checks existence.
 * Always validate with getUserContext() for protected operations.
 *
 * @returns true if session cookie exists, false otherwise
 *
 * @example
 * ```typescript
 * // In middleware - quick check before redirect
 * const hasSession = await hasSessionCookie();
 * if (!hasSession) {
 *   return NextResponse.redirect("/auth/sign-in");
 * }
 * // Full validation happens in server components
 * ```
 */
export async function hasSessionCookie(): Promise<boolean> {
	const token = await getSessionToken();
	return token !== undefined;
}

/**
 * Type for session token retrieval result
 */
export type SessionToken = string | undefined;
