/**
 * Client-Side CSRF Token Utility
 *
 * Provides functions to fetch and include CSRF tokens in API requests.
 */

export const CSRF_HEADER_NAME = "x-csrf-token";

let cachedToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

/**
 * Fetch CSRF token from the server
 * Results are cached to avoid redundant requests
 */
export async function getCsrfToken(): Promise<string> {
	// Return cached token if available
	if (cachedToken) {
		return cachedToken;
	}

	// Return existing promise if already fetching
	if (tokenPromise) {
		return tokenPromise;
	}

	// Fetch new token
	tokenPromise = (async () => {
		try {
			const response = await fetch("/api/csrf");

			if (!response.ok) {
				throw new Error("Failed to fetch CSRF token");
			}

			const data = await response.json();
			cachedToken = data.token;
			tokenPromise = null;

			return cachedToken as string;
		} catch (error) {
			tokenPromise = null;
			throw error;
		}
	})();

	return tokenPromise;
}

/**
 * Clear cached CSRF token
 * Use this when you want to force a fresh token fetch
 */
export function clearCsrfToken(): void {
	cachedToken = null;
	tokenPromise = null;
}

/**
 * Add CSRF token to fetch headers
 * Usage: fetch(url, await withCsrfToken({ method: 'POST', ... }))
 */
export async function withCsrfToken(
	options: RequestInit = {},
): Promise<RequestInit> {
	const token = await getCsrfToken();

	return {
		...options,
		headers: {
			...options.headers,
			[CSRF_HEADER_NAME]: token,
		},
	};
}

/**
 * Fetch wrapper that automatically includes CSRF token for state-changing methods
 */
export async function fetchWithCsrf(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	const method = init?.method?.toUpperCase() || "GET";
	const requiresToken = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

	if (requiresToken) {
		const token = await getCsrfToken();

		// Build headers - handle different header types
		let headersObj: Record<string, string> = {};

		if (init?.headers) {
			if (init.headers instanceof Headers) {
				// Convert Headers to plain object
				init.headers.forEach((value, key) => {
					headersObj[key] = value;
				});
			} else if (Array.isArray(init.headers)) {
				// Handle array format
				for (const [key, value] of init.headers) {
					headersObj[key] = value;
				}
			} else {
				// Plain object
				headersObj = { ...init.headers };
			}
		}

		// Add CSRF token
		headersObj[CSRF_HEADER_NAME] = token;

		return fetch(input, {
			...init,
			headers: headersObj,
		});
	}

	return fetch(input, init);
}
