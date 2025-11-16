/**
 * Security Validation Helpers
 *
 * Centralized utilities for CSRF and origin validation to prevent divergence.
 *
 * SECURITY: These validations are critical for preventing attacks:
 * - CSRF: Prevents Cross-Site Request Forgery attacks
 * - Origin: Prevents unauthorized cross-origin requests
 *
 * Any divergence in security validation logic could create vulnerabilities.
 */

import { cookies } from "next/headers";
import { validateCsrfToken, requiresCsrfProtection, CSRF_COOKIE_NAME } from "@/lib/csrf";
import { resolveAllowedOrigins, validateRequestOrigin, type OriginValidationResult } from "@/lib/request-origin";

/**
 * Options for CSRF validation
 */
export type CsrfValidationOptions = {
	/**
	 * Whether to skip CSRF validation for this request
	 * Use with EXTREME caution - only for endpoints with alternative protection
	 */
	skip?: boolean;

	/**
	 * Custom error message to return on validation failure
	 */
	errorMessage?: string;
};

/**
 * Result of CSRF validation
 */
export type CsrfValidationResult = {
	valid: boolean;
	error?: string;
};

/**
 * Validate CSRF token for the given request.
 *
 * This is a standardized helper that:
 * 1. Checks if CSRF protection is required (skips GET/HEAD/OPTIONS)
 * 2. Retrieves CSRF token from cookies
 * 3. Validates token against request header
 *
 * WHEN TO USE:
 * - All state-changing endpoints (POST, PUT, DELETE, PATCH)
 * - Before any expensive operations (after rate limiting, before auth)
 * - As early as possible in the request lifecycle
 *
 * @param request - The incoming HTTP request
 * @param options - Optional configuration
 * @returns Validation result with success flag and optional error
 *
 * @example
 * ```typescript
 * // In API route handler
 * export async function POST(request: Request) {
 *   // Validate CSRF protection
 *   const csrfResult = await validateCsrfForRequest(request);
 *   if (!csrfResult.valid) {
 *     return NextResponse.json(
 *       { error: csrfResult.error },
 *       { status: 403 }
 *     );
 *   }
 *
 *   // Continue with request processing...
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Skip CSRF for specific endpoint (use with caution!)
 * const csrfResult = await validateCsrfForRequest(request, { skip: true });
 * ```
 */
export async function validateCsrfForRequest(
	request: Request,
	options: CsrfValidationOptions = {},
): Promise<CsrfValidationResult> {
	// Allow explicit skip (use with caution!)
	if (options.skip) {
		return { valid: true };
	}

	// Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
	if (!requiresCsrfProtection(request.method)) {
		return { valid: true };
	}

	// Get CSRF token from cookies
	const cookieStore = await cookies();
	const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME);

	// Validate token
	const validation = validateCsrfToken(request, csrfCookie?.value);

	if (!validation.valid) {
		return {
			valid: false,
			error: options.errorMessage ?? validation.error ?? "CSRF validation failed",
		};
	}

	return { valid: true };
}

/**
 * Options for origin validation
 */
export type OriginValidationOptions = {
	/**
	 * Additional allowed origins beyond the defaults
	 */
	allowedOrigins?: string | string[];

	/**
	 * Whether to skip origin validation for this request
	 * Use with EXTREME caution - only for public endpoints
	 */
	skip?: boolean;

	/**
	 * Custom error message to return on validation failure
	 */
	errorMessage?: string;
};

/**
 * Result of origin validation with CORS headers
 */
export type OriginValidationResultWithHeaders = {
	ok: boolean;
	origin?: string;
	error?: string;
	corsHeaders?: HeadersInit;
};

/**
 * Validate request origin and build CORS headers.
 *
 * This is a standardized helper that:
 * 1. Resolves allowed origins from environment and options
 * 2. Validates the request origin
 * 3. Builds appropriate CORS headers
 *
 * WHEN TO USE:
 * - All API endpoints that accept cross-origin requests
 * - Before authentication to fail fast on invalid origins
 * - When you need to return CORS headers in responses
 *
 * @param request - The incoming HTTP request
 * @param options - Optional configuration
 * @returns Validation result with origin and CORS headers
 *
 * @example
 * ```typescript
 * // In API route handler
 * export async function POST(request: Request) {
 *   // Validate origin
 *   const originResult = await validateOriginForRequest(request);
 *   if (!originResult.ok) {
 *     return NextResponse.json(
 *       { error: "Invalid origin" },
 *       { status: 403 }
 *     );
 *   }
 *
 *   // ... process request ...
 *
 *   // Return response with CORS headers
 *   return NextResponse.json(
 *     { data: result },
 *     { headers: originResult.corsHeaders }
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With additional allowed origins
 * const result = await validateOriginForRequest(request, {
 *   allowedOrigins: ["https://partner.example.com"]
 * });
 * ```
 */
export async function validateOriginForRequest(
	request: Request,
	options: OriginValidationOptions = {},
): Promise<OriginValidationResultWithHeaders> {
	// Allow explicit skip (use with caution!)
	if (options.skip) {
		return { ok: true };
	}

	// Resolve allowed origins from environment and options
	const allowedOrigins = resolveAllowedOrigins(options.allowedOrigins);

	// Validate request origin
	const validation = validateRequestOrigin(request, allowedOrigins);

	if (!validation.ok) {
		return {
			ok: false,
			error: options.errorMessage ?? "Invalid request origin",
		};
	}

	// Build CORS headers
	const allowOrigin = validation.origin
		?? process.env.NEXT_PUBLIC_APP_URL
		?? process.env.CORS_ORIGIN
		?? null;

	const corsHeaders: HeadersInit = {};
	if (allowOrigin) {
		corsHeaders["Access-Control-Allow-Origin"] = allowOrigin;
		corsHeaders["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-CSRF-Token";
		corsHeaders["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
		corsHeaders["Access-Control-Allow-Credentials"] = "true";
		corsHeaders["Vary"] = "Origin";
	}

	return {
		ok: true,
		origin: validation.origin,
		corsHeaders,
	};
}

/**
 * Validate both CSRF and origin for a request.
 *
 * This is a convenience helper that combines both validations.
 * Use this for most API endpoints that need both protections.
 *
 * @param request - The incoming HTTP request
 * @param options - Combined options for both validations
 * @returns Combined validation result
 *
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   const validation = await validateRequestSecurity(request);
 *   if (!validation.csrfValid || !validation.originValid) {
 *     return NextResponse.json(
 *       { error: validation.error },
 *       { status: 403, headers: validation.corsHeaders }
 *     );
 *   }
 *
 *   // ... process request ...
 *
 *   return NextResponse.json(
 *     { data: result },
 *     { headers: validation.corsHeaders }
 *   );
 * }
 * ```
 */
export async function validateRequestSecurity(
	request: Request,
	options: CsrfValidationOptions & OriginValidationOptions = {},
): Promise<{
	csrfValid: boolean;
	originValid: boolean;
	origin?: string;
	error?: string;
	corsHeaders?: HeadersInit;
}> {
	// Validate origin first (cheaper operation)
	const originResult = await validateOriginForRequest(request, options);
	if (!originResult.ok) {
		return {
			csrfValid: false,
			originValid: false,
			error: originResult.error ?? "Invalid origin",
			corsHeaders: originResult.corsHeaders,
		};
	}

	// Then validate CSRF
	const csrfResult = await validateCsrfForRequest(request, options);
	if (!csrfResult.valid) {
		return {
			csrfValid: false,
			originValid: true,
			origin: originResult.origin,
			error: csrfResult.error ?? "CSRF validation failed",
			corsHeaders: originResult.corsHeaders,
		};
	}

	return {
		csrfValid: true,
		originValid: true,
		origin: originResult.origin,
		corsHeaders: originResult.corsHeaders,
	};
}
