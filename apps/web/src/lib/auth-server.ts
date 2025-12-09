import { cache } from "react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { logError } from "./logger-server";

export type UserContext = {
	userId: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

/**
 * Helper to build UserContext from WorkOS user object
 * WorkOS User fields use nullable types (string | null), not optional (string?)
 */
function buildUserContext(user: {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	profilePictureUrl: string | null;
}): UserContext {
	// Build name from firstName and lastName with proper null handling
	let name: string | null = null;
	if (user.firstName && user.lastName) {
		name = `${user.firstName} ${user.lastName}`;
	} else if (user.firstName) {
		name = user.firstName;
	} else if (user.lastName) {
		name = user.lastName;
	}

	return {
		userId: user.id,
		email: user.email,
		name,
		image: user.profilePictureUrl,
	};
}

/**
 * Cache the withAuth call per request using React cache()
 * This avoids duplicate auth checks within the same request across server components
 */
const resolveUserContext = cache(async (): Promise<UserContext> => {
	const { user } = await withAuth({ ensureSignedIn: true });

	// user is guaranteed by ensureSignedIn: true
	return buildUserContext(user);
});

export async function getUserContext(): Promise<UserContext> {
	return resolveUserContext();
}

export async function getUserId(): Promise<string> {
	const { userId } = await resolveUserContext();
	return userId;
}

/**
 * Get user context for API routes
 *
 * NOTE: The request parameter is kept for API compatibility but is unused.
 * WorkOS withAuth() reads session from Next.js cookies context automatically.
 *
 * Returns null if not authenticated (does NOT redirect).
 * API routes should return 401 when this returns null.
 */
export async function getUserContextFromRequest(
	_request: Request // Prefixed with _ to indicate intentionally unused
): Promise<UserContext | null> {
	try {
		// withAuth() can be called without ensureSignedIn to check auth status
		const { user } = await withAuth();

		if (!user) {
			return null;
		}

		return buildUserContext(user);
	} catch (error) {
		logError("Failed to get session from request", error);
		return null;
	}
}

/**
 * Invalidates a session from the cache
 * No-op for WorkOS - session management is handled by AuthKit
 * Kept for API compatibility
 */
export function invalidateSessionCache(_sessionToken: string): void {
	// WorkOS handles session management
}

/**
 * Clears the entire session cache
 * No-op for WorkOS - session management is handled by AuthKit
 * Kept for API compatibility
 */
export function clearSessionCache(): void {
	// WorkOS handles session management
}
