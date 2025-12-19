import { cache } from "react";
import { cookies } from "next/headers";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { logError, logDebug } from "./logger-server";

export type UserContext = {
	userId: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

/**
 * Better Auth helpers for Next.js server-side operations.
 */
const auth = convexBetterAuthNextJs({
	convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
	convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});

/**
 * Get the authentication token for Convex requests.
 * Use this when calling Convex functions from server-side code.
 */
export const getToken = auth.getToken;

/**
 * Check if the current request is authenticated.
 */
export const isAuthenticated = auth.isAuthenticated;

/**
 * Cookie name for auth session (must match auth-client.ts)
 */
const AUTH_SESSION_COOKIE = "ba_session";

/**
 * Get session from the ba_session cookie set by the client.
 * The crossDomainClient stores session in localStorage AND a cookie via hybridStorage.
 */
async function getSessionFromCookie(): Promise<{
	userId: string;
	email?: string;
	name?: string;
	image?: string;
} | null> {
	try {
		const cookieStore = await cookies();
		const sessionCookie = cookieStore.get(AUTH_SESSION_COOKIE);

		if (!sessionCookie?.value) {
			logDebug("[auth-server] No ba_session cookie found");
			return null;
		}

		// The cookie contains the session data from crossDomainClient
		const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
		logDebug(`[auth-server] Found session cookie with user: ${sessionData?.user?.email}`);

		if (!sessionData?.user) {
			logDebug("[auth-server] No user in session cookie");
			return null;
		}

		return {
			userId: sessionData.user.id,
			email: sessionData.user.email,
			name: sessionData.user.name,
			image: sessionData.user.image,
		};
	} catch (error) {
		logError("[auth-server] Failed to parse session cookie", error);
		return null;
	}
}

/**
 * Cache the session resolution per request using React cache()
 * This avoids duplicate auth checks within the same request across server components.
 */
const resolveUserContext = cache(async (): Promise<UserContext | null> => {
	const session = await getSessionFromCookie();

	if (!session) {
		return null;
	}

	return {
		userId: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	};
});

/**
 * Get the current user context.
 * Returns the user context or throws if not authenticated.
 */
export async function getUserContext(): Promise<UserContext> {
	const context = await resolveUserContext();

	if (!context) {
		throw new Error("Not authenticated");
	}

	return context;
}

/**
 * Get the current user ID.
 * Returns the user ID or throws if not authenticated.
 */
export async function getUserId(): Promise<string> {
	const context = await getUserContext();
	return context.userId;
}

/**
 * Get user context for API routes.
 * Returns null if not authenticated (does NOT throw).
 * API routes should return 401 when this returns null.
 */
export async function getUserContextFromRequest(
	_request: Request
): Promise<UserContext | null> {
	return resolveUserContext();
}

/**
 * Invalidates a session from the cache
 * No-op for Better Auth - session management is handled by the auth system
 * Kept for API compatibility
 */
export function invalidateSessionCache(_sessionToken: string): void {
	// Better Auth handles session management
}

/**
 * Clears the entire session cache
 * No-op for Better Auth - session management is handled by the auth system
 * Kept for API compatibility
 */
export function clearSessionCache(): void {
	// Better Auth handles session management
}
