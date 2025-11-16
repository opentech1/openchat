import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { logError } from "./logger-server";

export type UserContext = {
	userId: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

type SessionCacheEntry = {
	user: UserContext;
	timestamp: number;
};

const sessionCache = new Map<string, SessionCacheEntry>();
const SESSION_CACHE_TTL_MS = 30_000; // 30 seconds

// Get session from better-auth API
// Using React cache() to avoid duplicate fetches within the same request across server components
// Also implements Map-based caching with 30-second TTL to eliminate repeated HTTP calls
const resolveUserContext = cache(async (): Promise<UserContext> => {
	const cookieStore = await cookies();

	// better-auth stores session token with the cookiePrefix from convex/auth.ts
	// In production (HTTPS), cookies get __Secure- prefix: "__Secure-openchat.session_token"
	// In development (HTTP), cookies don't have prefix: "openchat.session_token"
	const secureCookie = cookieStore.get("__Secure-openchat.session_token");
	const normalCookie = cookieStore.get("openchat.session_token");
	const sessionCookie = secureCookie || normalCookie;

	if (!sessionCookie?.value) {
		redirect("/auth/sign-in");
	}

	// Check cache first
	const now = Date.now();
	const cached = sessionCache.get(sessionCookie.value);
	if (cached && (now - cached.timestamp) < SESSION_CACHE_TTL_MS) {
		return cached.user;
	}

	// Call better-auth API to get session
	try {
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "http://localhost:3000";
		// Use the correct cookie name based on which one exists
		const cookieName = secureCookie ? "__Secure-openchat.session_token" : "openchat.session_token";
		const response = await fetch(`${baseUrl}/api/auth/get-session`, {
			headers: {
				Cookie: `${cookieName}=${sessionCookie.value}`,
			},
			cache: "no-store",
		});

		if (!response.ok) {
			redirect("/auth/sign-in");
		}

		const data = await response.json();

		if (!data || !data.user) {
			redirect("/auth/sign-in");
		}

		const user: UserContext = {
			userId: data.user.id,
			email: data.user.email,
			name: data.user.name,
			image: data.user.image,
		};

		// Store in cache
		sessionCache.set(sessionCookie.value, { user, timestamp: now });

		// Cleanup old entries to prevent memory leaks
		if (sessionCache.size > 1000) {
			for (const [key, entry] of sessionCache.entries()) {
				if (now - entry.timestamp >= SESSION_CACHE_TTL_MS) {
					sessionCache.delete(key);
				}
			}
		}

		return user;
	} catch (error) {
		logError("Failed to get session", error);
		redirect("/auth/sign-in");
	}
});

export async function getUserContext(): Promise<UserContext> {
	return resolveUserContext();
}

export async function getUserId(): Promise<string> {
	const { userId } = await resolveUserContext();
	return userId;
}
