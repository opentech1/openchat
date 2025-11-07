/**
 * API Version Middleware
 *
 * Handles API versioning for all API routes.
 *
 * DESIGN:
 * - New endpoints should use explicit versions: /api/v1/chats
 * - Legacy endpoints without version: /api/chats (treated as v1 for backwards compat)
 * - Version is extracted from URL path and validated
 * - Deprecated versions return warning headers but still work
 * - Unsupported versions return 400 Bad Request
 *
 * USAGE:
 * ```typescript
 * export async function GET(request: Request) {
 *   return withApiVersionCheck(request, async (version) => {
 *     // Your handler logic here
 *     // version is guaranteed to be valid
 *     return NextResponse.json({ data: "..." });
 *   });
 * }
 * ```
 */

import {
	API_VERSION,
	isSupportedApiVersion,
	isDeprecatedApiVersion,
	type ApiVersion,
} from "./constants";
import { logWarn, logInfo } from "./logger-server";

/**
 * API version extraction result
 */
export type ApiVersionInfo = {
	/** The extracted version (defaults to v1 if not specified) */
	version: ApiVersion;
	/** Whether this is a legacy unversioned route */
	isLegacy: boolean;
	/** Whether this version is deprecated */
	isDeprecated: boolean;
};

/**
 * Extract API version from request URL
 *
 * @param request - The incoming request
 * @returns Version information
 *
 * @example
 * ```typescript
 * // /api/v1/chats -> { version: "v1", isLegacy: false, isDeprecated: false }
 * // /api/chats -> { version: "v1", isLegacy: true, isDeprecated: false }
 * // /api/v2/chats -> { version: "v2", isLegacy: false, isDeprecated: false }
 * ```
 */
export function extractApiVersion(request: Request): ApiVersionInfo {
	try {
		const url = new URL(request.url);
		const pathParts = url.pathname.split("/").filter(Boolean);

		// Expected format: /api/v1/resource or /api/resource
		if (pathParts[0] !== "api") {
			// Not an API route, default to current version
			return {
				version: API_VERSION,
				isLegacy: false,
				isDeprecated: false,
			};
		}

		// Check if second part is a version
		const potentialVersion = pathParts[1];

		if (!potentialVersion) {
			// /api/ with nothing after
			return {
				version: API_VERSION,
				isLegacy: true,
				isDeprecated: false,
			};
		}

		// Check if it starts with 'v' and is a known version
		if (potentialVersion.startsWith("v")) {
			const version = potentialVersion as ApiVersion;

			return {
				version: isSupportedApiVersion(version) ? version : API_VERSION,
				isLegacy: false,
				isDeprecated: isDeprecatedApiVersion(version),
			};
		}

		// No version specified, treat as legacy v1
		return {
			version: API_VERSION,
			isLegacy: true,
			isDeprecated: false,
		};
	} catch (error) {
		logWarn("Error parsing API version from URL", { error });
		return {
			version: API_VERSION,
			isLegacy: false,
			isDeprecated: false,
		};
	}
}

/**
 * Validate API version and create appropriate response headers
 *
 * @param versionInfo - Version information from extractApiVersion
 * @returns Headers to add to the response
 */
export function createApiVersionHeaders(versionInfo: ApiVersionInfo): HeadersInit {
	const headers: HeadersInit = {
		"X-API-Version": versionInfo.version,
	};

	// Add warning for legacy routes
	if (versionInfo.isLegacy) {
		headers["Warning"] = `299 - "Using legacy unversioned API route. Please migrate to /api/${versionInfo.version}/ endpoints."`;
	}

	// Add deprecation warning
	if (versionInfo.isDeprecated) {
		headers["Warning"] = `299 - "API version ${versionInfo.version} is deprecated and will be removed in a future release. Please upgrade to the latest version."`;
		headers["Deprecation"] = "true";
	}

	return headers;
}

/**
 * Middleware wrapper for API version checking
 *
 * @param request - The incoming request
 * @param handler - The actual route handler to call
 * @returns Response with appropriate version headers
 *
 * @example
 * ```typescript
 * export async function GET(request: Request) {
 *   return withApiVersionCheck(request, async (versionInfo) => {
 *     // Your handler logic here
 *     const data = await getData();
 *     return NextResponse.json({ data });
 *   });
 * }
 * ```
 */
export async function withApiVersionCheck(
	request: Request,
	handler: (versionInfo: ApiVersionInfo) => Promise<Response>,
): Promise<Response> {
	const versionInfo = extractApiVersion(request);

	// Log legacy API usage for monitoring
	if (versionInfo.isLegacy) {
		logInfo("Legacy API route accessed", {
			path: new URL(request.url).pathname,
			version: versionInfo.version,
		});
	}

	// Log deprecated API usage for monitoring
	if (versionInfo.isDeprecated) {
		logWarn("Deprecated API version accessed", {
			path: new URL(request.url).pathname,
			version: versionInfo.version,
		});
	}

	try {
		// Call the handler
		const response = await handler(versionInfo);

		// Add version headers to response
		const versionHeaders = createApiVersionHeaders(versionInfo);

		// Clone response to add headers
		const newResponse = new Response(response.body, response);
		for (const [key, value] of Object.entries(versionHeaders)) {
			newResponse.headers.set(key, value);
		}

		return newResponse;
	} catch (error) {
		// Re-throw to let error handler deal with it
		throw error;
	}
}

/**
 * Create a versioned API path
 *
 * Helper for constructing versioned API paths in client code.
 *
 * @param version - API version
 * @param path - Path after version (should start with /)
 * @returns Full versioned path
 *
 * @example
 * ```typescript
 * const path = createVersionedPath("v1", "/chats");
 * // Returns: "/api/v1/chats"
 * ```
 */
export function createVersionedPath(version: ApiVersion, path: string): string {
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	return `/api/${version}${cleanPath}`;
}

/**
 * Check if request is an API route
 *
 * @param request - The incoming request
 * @returns Whether this is an API route
 */
export function isApiRoute(request: Request): boolean {
	try {
		const url = new URL(request.url);
		return url.pathname.startsWith("/api/");
	} catch {
		return false;
	}
}
