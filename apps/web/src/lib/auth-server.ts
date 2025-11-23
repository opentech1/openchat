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

/**
 * Invalidates a session from the cache
 * Should be called on logout to prevent serving stale sessions
 */
export function invalidateSessionCache(sessionToken: string): void {
	sessionCache.delete(sessionToken);
}

/**
 * Clears the entire session cache
 * Useful for security-critical operations
 */
export function clearSessionCache(): void {
	sessionCache.clear();
}

// Get session from better-auth API
// Using React cache() to avoid duplicate fetches within the same request across server components
// Also implements Map-based caching with 30-second TTL to eliminate repeated HTTP calls
const resolveUserContext = cache(async (): Promise<UserContext> => {
	const cookieStore = await cookies();

	// Forward ALL cookies to the auth API instead of manually checking specific names
	// This ensures compatibility regardless of how better-auth/convex sets cookies
	const allCookies = cookieStore.getAll();
	const cookieHeader = allCookies
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	// If no cookies at all, redirect immediately
	if (!cookieHeader) {
		redirect("/auth/sign-in");
	}

	// Generate a cache key from cookies that look like session tokens
	const sessionCookie = allCookies.find(
		(c) => c.name.includes("session") || c.name.includes("token")
	);
	const cacheKey = sessionCookie?.value || cookieHeader.slice(0, 64);

	// Check cache first
	const now = Date.now();
	const cached = sessionCache.get(cacheKey);
	if (cached && now - cached.timestamp < SESSION_CACHE_TTL_MS) {
		return cached.user;
	}

	// Call better-auth API to get session
	try {
		const baseUrl =
			process.env.NEXT_PUBLIC_APP_URL ||
			process.env.SITE_URL ||
			"http://localhost:3000";
		const response = await fetch(`${baseUrl}/api/auth/get-session`, {
			headers: {
				Cookie: cookieHeader,
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
		sessionCache.set(cacheKey, { user, timestamp: now });

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
