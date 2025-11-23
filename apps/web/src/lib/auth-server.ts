import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
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
	// Try both cookies() and headers() to diagnose the issue
	const cookieStore = await cookies();
	const headerStore = await headers();

	// Forward ALL cookies to the auth API instead of manually checking specific names
	// This ensures compatibility regardless of how better-auth/convex sets cookies
	const allCookies = cookieStore.getAll();

	// Also try getting Cookie header directly via headers()
	const rawCookieHeader = headerStore.get("cookie");

	// Debug logging to understand what cookies the server receives
	console.log("[Auth Server] cookies() returned:", allCookies.length, "cookies");
	console.log("[Auth Server] headers().get('cookie'):", rawCookieHeader ? "has value" : "empty/null");
	if (allCookies.length > 0) {
		console.log("[Auth Server] Cookie names from cookies():", allCookies.map(c => c.name).join(", "));
	}
	if (rawCookieHeader) {
		console.log("[Auth Server] Raw cookie header length:", rawCookieHeader.length);
	}

	// Prefer raw cookie header if available, fall back to cookies()
	const cookieHeader = rawCookieHeader || allCookies
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	// If no cookies at all, redirect immediately
	if (!cookieHeader) {
		console.log("[Auth Server] No cookies found from either source, redirecting to sign-in");
		redirect("/auth/sign-in");
	}

	// Find a session-like cookie for cache key generation
	// IMPORTANT: Only cache if we have a unique session identifier to prevent cross-user cache collisions
	const sessionCookie = allCookies.find(
		(c) => c.name.includes("session") || c.name.includes("token")
	);
	const cacheKey = sessionCookie?.value;

	// Check cache first (only if we have a valid session cookie as cache key)
	const now = Date.now();
	if (cacheKey) {
		const cached = sessionCache.get(cacheKey);
		if (cached && now - cached.timestamp < SESSION_CACHE_TTL_MS) {
			return cached.user;
		}
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

		// Store in cache only if we have a unique session identifier
		if (cacheKey) {
			sessionCache.set(cacheKey, { user, timestamp: now });
		}

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

/**
 * Get user context from a Request object (for API routes)
 *
 * This reads cookies directly from the request headers instead of using
 * next/headers cookies() which doesn't work in some environments.
 *
 * Returns null if not authenticated (does NOT redirect).
 * API routes should return 401 when this returns null.
 */
export async function getUserContextFromRequest(request: Request): Promise<UserContext | null> {
	const cookieHeader = request.headers.get("cookie");

	if (!cookieHeader) {
		console.log("[Auth Server API] No cookie header in request");
		return null;
	}

	// Find a session-like cookie for cache key generation
	const sessionMatch = cookieHeader.match(/(?:session|token)[^=]*=([^;]+)/i);
	const cacheKey = sessionMatch?.[1];

	// Check cache first (only if we have a valid session cookie as cache key)
	const now = Date.now();
	if (cacheKey) {
		const cached = sessionCache.get(cacheKey);
		if (cached && now - cached.timestamp < SESSION_CACHE_TTL_MS) {
			return cached.user;
		}
	}

	// Call Convex auth endpoint directly to get session
	// This avoids internal routing issues in serverless environments
	try {
		// Prefer calling Convex directly to avoid internal HTTP routing issues
		const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
		const sessionUrl = convexSiteUrl
			? `${convexSiteUrl}/auth/get-session`
			: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/get-session`;

		console.log("[Auth Server API] Fetching session from:", sessionUrl);

		const response = await fetch(sessionUrl, {
			headers: {
				Cookie: cookieHeader,
			},
			cache: "no-store",
		});

		if (!response.ok) {
			console.log("[Auth Server API] Auth response not ok:", response.status);
			return null;
		}

		const data = await response.json();

		if (!data || !data.user) {
			console.log("[Auth Server API] No user in session data");
			return null;
		}

		const user: UserContext = {
			userId: data.user.id,
			email: data.user.email,
			name: data.user.name,
			image: data.user.image,
		};

		// Store in cache only if we have a unique session identifier
		if (cacheKey) {
			sessionCache.set(cacheKey, { user, timestamp: now });
		}

		return user;
	} catch (error) {
		logError("Failed to get session from request", error);
		return null;
	}
}
