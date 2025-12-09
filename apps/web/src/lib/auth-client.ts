"use client";

/**
 * Auth Client - Client-side auth utilities
 *
 * This module provides CLIENT-SAFE authentication utilities:
 * 1. better-auth client (used by ConvexBetterAuthProvider)
 * 2. WorkOS AuthKit hooks (useAuth, AuthKitProvider)
 *
 * IMPORTANT: This file is for CLIENT components only.
 * For server-side auth (getSignInUrl, signOut, withAuth), import from
 * @workos-inc/authkit-nextjs directly in your server component/action,
 * or use auth-server.ts utilities.
 *
 * DO NOT import server-only functions here - they use Node.js APIs
 * (node:https, node:http) that cannot be bundled for the browser.
 */

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// Re-export WorkOS hooks for client components (these are client-safe)
export { useAuth, AuthKitProvider } from "@workos-inc/authkit-nextjs/components";

// Import useAuth for use in our compatibility hook
import { useAuth } from "@workos-inc/authkit-nextjs/components";

/**
 * Better Auth client for Convex
 *
 * This is the primary auth client used by ConvexBetterAuthProvider.
 * Uses the convexClient plugin for routing to /api/auth/[...all].
 */
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_APP_URL || "",
	plugins: [convexClient()],
	fetchOptions: {
		credentials: "include",
	},
});

// Type for the compatibility session format (used by useSession)
interface CompatibilityUser {
	id: string;
	email: string;
	name: string;
	image: string | null;
}

interface CompatibilitySession {
	user: CompatibilityUser;
}

interface UseSessionResult {
	data: CompatibilitySession | null;
	isPending: boolean;
}

/**
 * Compatibility hook that wraps WorkOS useAuth to provide a session-like interface.
 * This is a proper React hook that can be used in components.
 *
 * Use this for components that need to access user data client-side.
 * For Convex integration, use authClient directly.
 */
export function useSession(): UseSessionResult {
	const { user, loading } = useAuth();

	return {
		data: user
			? {
					user: {
						id: user.id,
						email: user.email,
						name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
						image: user.profilePictureUrl ?? null,
					},
				}
			: null,
		isPending: loading,
	};
}

// Type for user from WorkOS (exported for convenience)
export interface WorkOSUser {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	profilePictureUrl: string | null;
}
