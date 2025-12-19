"use client";

/**
 * Auth Client - Client-side auth utilities using Better Auth
 *
 * This module provides CLIENT-SAFE authentication utilities.
 * Uses Better Auth with Convex integration for GitHub OAuth.
 */

import { createAuthClient } from "better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";

/**
 * Cookie name for storing auth session (synced from localStorage for server-side access)
 */
const AUTH_SESSION_COOKIE = "ba_session";

/**
 * Sync session from localStorage to cookie.
 * This is called on page load to ensure the cookie is set for server-side access.
 */
function syncSessionToCookie() {
	if (typeof window === "undefined") return;

	// Look for the session in localStorage (crossDomainClient uses "ba_" prefix by default)
	const keys = Object.keys(localStorage).filter(k => k.includes("session"));
	for (const key of keys) {
		const value = localStorage.getItem(key);
		if (value) {
			const isSecure = window.location.protocol === "https:";
			const secureFlag = isSecure ? "; Secure" : "";
			document.cookie = `${AUTH_SESSION_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secureFlag}`;
			break; // Only need one session cookie
		}
	}
}

// Sync existing sessions on module load
if (typeof window !== "undefined") {
	syncSessionToCookie();
}

/**
 * Custom storage that writes to both localStorage and cookies.
 * This allows server-side code to access the session via cookies.
 */
const hybridStorage = {
	setItem: (key: string, value: string) => {
		// Store in localStorage (primary)
		localStorage.setItem(key, value);

		// Also store in a cookie for server-side access
		// Use a single cookie with the full session data
		if (key.includes("session")) {
			const isSecure = window.location.protocol === "https:";
			const secureFlag = isSecure ? "; Secure" : "";
			document.cookie = `${AUTH_SESSION_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secureFlag}`;
		}
	},
	getItem: (key: string) => {
		return localStorage.getItem(key);
	},
	removeItem: (key: string) => {
		localStorage.removeItem(key);

		// Also remove the cookie
		if (key.includes("session")) {
			document.cookie = `${AUTH_SESSION_COOKIE}=; path=/; max-age=0`;
		}
	},
};

/**
 * Better Auth client configured for Convex integration.
 * Uses the Convex site URL as the base URL for auth requests.
 *
 * crossDomainClient is required because the frontend (localhost:3000) and
 * auth backend (convex.site) are on different domains. It handles session
 * transfer via one-time tokens after OAuth callback.
 *
 * We use custom hybridStorage to sync session to cookies for server-side access.
 */
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
	plugins: [
		convexClient(),
		crossDomainClient({
			storage: hybridStorage,
		}),
	],
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
 * Hook to get the current session with user data.
 * Provides a compatibility layer for components that expect the old session format.
 */
export function useSession(): UseSessionResult {
	const { data: session, isPending } = authClient.useSession();

	return {
		data: session?.user
			? {
					user: {
						id: session.user.id,
						email: session.user.email,
						name: session.user.name || session.user.email.split("@")[0] || "User",
						image: session.user.image ?? null,
					},
				}
			: null,
		isPending,
	};
}

/**
 * Hook to get the raw Better Auth session.
 * Use this when you need access to the full session object.
 */
export function useAuth() {
	const { data: session, isPending } = authClient.useSession();

	return {
		user: session?.user ?? null,
		session: session?.session ?? null,
		loading: isPending,
		isAuthenticated: !!session?.user,
	};
}

/**
 * Sign in with GitHub OAuth.
 * Redirects to GitHub for authentication.
 */
export async function signInWithGitHub(callbackURL = "/") {
	return authClient.signIn.social({
		provider: "github",
		callbackURL,
	});
}

/**
 * Sign out the current user.
 * Clears the session and redirects to sign-in.
 */
export async function signOut() {
	return authClient.signOut({
		fetchOptions: {
			onSuccess: () => {
				window.location.href = "/auth/sign-in";
			},
		},
	});
}
