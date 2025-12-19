/**
 * Content-Type Validation Utility
 *
 * Validates Content-Type headers to prevent MIME confusion attacks.
 *
 * SECURITY: Always validate Content-Type headers for POST/PUT/PATCH requests
 * to prevent attackers from uploading malicious content that browsers might
 * execute in unexpected ways.
 *
 * MIME confusion attacks occur when:
 * 1. Client sends malicious content with incorrect Content-Type
 * 2. Server accepts it without validation
 * 3. Browser sniffs the content and executes it (despite X-Content-Type-Options)
 *
 * Example:
 * - Attacker uploads "image/png" that's actually JavaScript
 * - Server stores it without checking actual content
 * - If served later, browser might execute it depending on context
 */

/**
 * Allowed Content-Type values for API requests
 */
export const ALLOWED_CONTENT_TYPES = {
	JSON: "application/json",
	FORM_URLENCODED: "application/x-www-form-urlencoded",
	MULTIPART: "multipart/form-data",
	TEXT: "text/plain",
} as const;

/**
 * Content-Type validation result
 */
export type ContentTypeValidation = {
	/** Whether the Content-Type is valid */
	valid: boolean;
	/** The parsed Content-Type (without parameters) */
	contentType?: string;
	/** The charset if specified */
	charset?: string;
	/** Reason for validation failure */
	reason?: string;
};

/**
 * Validate Content-Type header
 *
 * @param request - The incoming request
 * @param allowedTypes - Array of allowed Content-Type values (defaults to JSON only)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * // In API route handler
 * export async function POST(request: Request) {
 *   const validation = validateContentType(request);
 *
 *   if (!validation.valid) {
 *     return new Response(
 *       JSON.stringify({ error: "Invalid Content-Type" }),
 *       { status: 415 } // 415 Unsupported Media Type
 *     );
 *   }
 *
 *   // Continue with request processing...
 * }
 * ```
 */
export function validateContentType(
	request: Request,
	allowedTypes: readonly string[] = [ALLOWED_CONTENT_TYPES.JSON],
): ContentTypeValidation {
	const contentTypeHeader = request.headers.get("content-type");

	// Content-Type must be present for POST/PUT/PATCH
	if (!contentTypeHeader) {
		return {
			valid: false,
			reason: "Missing Content-Type header",
		};
	}

	// Parse Content-Type (format: "type/subtype; charset=utf-8")
	const [contentType, ...params] = contentTypeHeader.split(";").map((s) => s.trim());

	if (!contentType) {
		return {
			valid: false,
			reason: "Invalid Content-Type format",
		};
	}

	// Extract charset if present
	const charsetParam = params.find((p) => p.startsWith("charset="));
	const charset = charsetParam?.split("=")[1]?.trim();

	// Check if Content-Type is in allowed list
	const isAllowed = allowedTypes.some((allowed) => {
		// Handle multipart/form-data with boundary parameter
		if (allowed === ALLOWED_CONTENT_TYPES.MULTIPART) {
			return contentType.toLowerCase().startsWith("multipart/form-data");
		}
		return contentType.toLowerCase() === allowed.toLowerCase();
	});

	if (!isAllowed) {
		return {
			valid: false,
			contentType,
			charset,
			reason: `Content-Type '${contentType}' not allowed. Expected one of: ${allowedTypes.join(", ")}`,
		};
	}

	return {
		valid: true,
		contentType,
		charset,
	};
}

/**
 * Create a 415 Unsupported Media Type response
 *
 * @param validation - The validation result
 * @param allowedTypes - Array of allowed Content-Type values
 * @returns Response with 415 status
 */
export function createUnsupportedMediaTypeResponse(
	validation: ContentTypeValidation,
	allowedTypes: readonly string[] = [ALLOWED_CONTENT_TYPES.JSON],
): Response {
	return new Response(
		JSON.stringify({
			error: "Unsupported Media Type",
			message: validation.reason || "Invalid Content-Type header",
			allowedTypes,
		}),
		{
			status: 415,
			headers: {
				"Content-Type": "application/json",
				// Tell client what types are accepted
				Accept: allowedTypes.join(", "),
			},
		},
	);
}

/**
 * Middleware wrapper for Content-Type validation
 *
 * @param request - The incoming request
 * @param allowedTypes - Array of allowed Content-Type values
 * @param handler - The actual route handler to call if validation passes
 * @returns Response from handler or 415 error
 *
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   return withContentTypeValidation(
 *     request,
 *     [ALLOWED_CONTENT_TYPES.JSON],
 *     async () => {
 *       // Your handler logic here
 *       const body = await request.json();
 *       return NextResponse.json({ success: true });
 *     }
 *   );
 * }
 * ```
 */
export async function withContentTypeValidation(
	request: Request,
	allowedTypes: readonly string[],
	handler: () => Promise<Response>,
): Promise<Response> {
	// Only validate for methods that typically have a body
	const methodsToValidate = ["POST", "PUT", "PATCH"];
	if (!methodsToValidate.includes(request.method)) {
		return handler();
	}

	const validation = validateContentType(request, allowedTypes);

	if (!validation.valid) {
		return createUnsupportedMediaTypeResponse(validation, allowedTypes);
	}

	return handler();
}
