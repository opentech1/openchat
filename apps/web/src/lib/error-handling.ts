/**
 * Error Handling Patterns
 *
 * Standardized error handling utilities and patterns for consistent
 * error management across the application.
 *
 * PRINCIPLES:
 * - Fail fast, recover gracefully
 * - Log errors for debugging
 * - Return helpful error messages
 * - Never expose sensitive information
 * - Maintain type safety
 *
 * ERROR TYPES:
 * - Validation errors (user input)
 * - Authentication errors (missing/invalid credentials)
 * - Authorization errors (insufficient permissions)
 * - Not found errors (resource doesn't exist)
 * - Network errors (API calls, database)
 * - Server errors (unexpected failures)
 */

import { logError, logWarn, type LogContext } from "./logger-server";
import { ZodError } from "zod";

/**
 * Custom error types
 */

/**
 * Type guards for error handling
 */

/**
 * API Error type
 *
 * Represents errors from API calls with tracking and status information
 */
export type ApiError = {
	__posthogTracked?: boolean;
	status?: number;
	providerUrl?: string;
	message?: string;
	cause?: unknown;
};

/**
 * Type guard for API errors
 *
 * @param error - Value to check
 * @returns True if error is an object with API error properties
 */
export function isApiError(error: unknown): error is ApiError {
	return typeof error === "object" && error !== null;
}

/**
 * Message Part types for chat messages
 */
export type MessagePart = TextPart | FilePart;

export type TextPart = {
	type: "text";
	text: string;
};

export type FilePart = {
	type: "file";
	data?: string;
	url?: string;
	filename?: string;
	mediaType?: string;
};

/**
 * Type guard for text message parts
 *
 * @param part - Value to check
 * @returns True if part is a text message part
 */
export function isTextPart(part: unknown): part is TextPart {
	return (
		typeof part === "object" &&
		part !== null &&
		"type" in part &&
		part.type === "text" &&
		"text" in part &&
		typeof part.text === "string"
	);
}

/**
 * Type guard for file message parts
 *
 * @param part - Value to check
 * @returns True if part is a file message part
 */
export function isFilePart(part: unknown): part is FilePart {
	return (
		typeof part === "object" &&
		part !== null &&
		"type" in part &&
		part.type === "file"
	);
}

/**
 * Application Error
 *
 * Base error class for all application errors.
 * Extends Error with additional properties for better error handling.
 */
export class AppError extends Error {
	public readonly statusCode: number;
	public readonly code: string;
	public readonly isOperational: boolean;

	constructor(
		message: string,
		statusCode: number,
		code: string,
		isOperational = true,
	) {
		super(message);
		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.code = code;
		this.isOperational = isOperational;

		// Maintains proper stack trace
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Validation Error
 *
 * Thrown when user input fails validation.
 */
export class ValidationError extends AppError {
	public readonly fields?: Record<string, string>;

	constructor(message: string, fields?: Record<string, string>) {
		super(message, 400, "VALIDATION_ERROR");
		this.fields = fields;
	}
}

/**
 * Authentication Error
 *
 * Thrown when authentication fails or is missing.
 */
export class AuthenticationError extends AppError {
	constructor(message = "Authentication required") {
		super(message, 401, "AUTHENTICATION_ERROR");
	}
}

/**
 * Authorization Error
 *
 * Thrown when user lacks permission for an action.
 */
export class AuthorizationError extends AppError {
	constructor(message = "Insufficient permissions") {
		super(message, 403, "AUTHORIZATION_ERROR");
	}
}

/**
 * Not Found Error
 *
 * Thrown when a resource is not found.
 */
export class NotFoundError extends AppError {
	constructor(resource: string) {
		super(`${resource} not found`, 404, "NOT_FOUND_ERROR");
	}
}

/**
 * Rate Limit Error
 *
 * Thrown when rate limit is exceeded.
 */
export class RateLimitError extends AppError {
	public readonly retryAfter: number;

	constructor(retryAfter: number) {
		super("Too many requests", 429, "RATE_LIMIT_ERROR");
		this.retryAfter = retryAfter;
	}
}

/**
 * Network Error
 *
 * Thrown when external API call fails.
 */
export class NetworkError extends AppError {
	constructor(message: string, cause?: Error) {
		super(message, 503, "NETWORK_ERROR");
		this.cause = cause;
	}
}

/**
 * Database Error
 *
 * Thrown when database operation fails.
 */
export class DatabaseError extends AppError {
	constructor(message: string, cause?: Error) {
		super(message, 500, "DATABASE_ERROR", false);
		this.cause = cause;
	}
}

/**
 * Error Response Utilities
 */

/**
 * Error response format
 */
export type ErrorResponse = {
	error: string;
	message: string;
	code?: string;
	fields?: Record<string, string>;
	statusCode: number;
};

/**
 * Convert error to HTTP response
 *
 * Standardizes error responses across the application.
 * Handles both known (AppError) and unknown errors.
 *
 * SECURITY:
 * - Never exposes stack traces in production
 * - Sanitizes sensitive information
 * - Returns generic message for unknown errors
 *
 * @param error - Error to convert
 * @param includeStack - Include stack trace (development only)
 * @returns Response object
 *
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   try {
 *     // Your handler logic
 *     return NextResponse.json({ success: true });
 *   } catch (error) {
 *     return errorToResponse(error);
 *   }
 * }
 * ```
 */
export function errorToResponse(
	error: unknown,
	_includeStack = false,
): Response {
	const isDevelopment = process.env.NODE_ENV === "development";

	// Handle known application errors
	if (error instanceof AppError) {
		const responseBody: ErrorResponse = {
			error: error.name,
			message: error.message,
			code: error.code,
			statusCode: error.statusCode,
		};

		// Add field errors for validation errors
		if (error instanceof ValidationError && error.fields) {
			responseBody.fields = error.fields;
		}

		// Add retry-after for rate limit errors
		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		if (error instanceof RateLimitError) {
			headers["Retry-After"] = error.retryAfter.toString();
		}

		return new Response(JSON.stringify(responseBody), {
			status: error.statusCode,
			headers,
		});
	}

	// Handle Zod validation errors
	if (error instanceof ZodError) {
		const fields: Record<string, string> = {};

		for (const issue of error.issues) {
			const path = issue.path.join(".");
			fields[path] = issue.message;
		}

		return errorToResponse(new ValidationError("Validation failed", fields));
	}

	// Handle unknown errors
	logError("Unhandled error", error);

	const message = isDevelopment
		? error instanceof Error
			? error.message
			: "An unknown error occurred"
		: "Internal server error";

	const responseBody: ErrorResponse = {
		error: "InternalServerError",
		message,
		code: "INTERNAL_ERROR",
		statusCode: 500,
	};

	return new Response(JSON.stringify(responseBody), {
		status: 500,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

/**
 * Try-Catch Wrapper
 *
 * Wraps async functions with error handling.
 * Automatically converts errors to HTTP responses.
 *
 * @param handler - Async function to wrap
 * @returns Wrapped function that returns Response
 *
 * @example
 * ```typescript
 * export const POST = withErrorHandling(async (request: Request) => {
 *   const body = await request.json();
 *
 *   // This will be caught and converted to error response
 *   if (!body.title) {
 *     throw new ValidationError("Title is required");
 *   }
 *
 *   const chat = await createChat(body);
 *   return NextResponse.json({ chat });
 * });
 * ```
 */
export function withErrorHandling<T extends unknown[]>(
	handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
	return async (...args: T) => {
		try {
			return await handler(...args);
		} catch (error) {
			return errorToResponse(error);
		}
	};
}

/**
 * Async Operation Wrapper
 *
 * Wraps async operations with error handling and logging.
 * Returns either the result or null on error.
 *
 * @param operation - Async operation to execute
 * @param errorMessage - Message to log on error
 * @returns Result or null
 *
 * @example
 * ```typescript
 * const user = await safeAsync(
 *   () => fetchUser(userId),
 *   "Failed to fetch user"
 * );
 *
 * if (!user) {
 *   // Handle error case
 *   return null;
 * }
 * ```
 */
export async function safeAsync<T>(
	operation: () => Promise<T>,
	errorMessage: string,
): Promise<T | null> {
	try {
		return await operation();
	} catch (error) {
		logError(errorMessage, error);
		return null;
	}
}

/**
 * Retry Logic
 *
 * Retries an operation with exponential backoff.
 *
 * @param operation - Operation to retry
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @param delayMs - Initial delay in milliseconds (default: 1000)
 * @returns Result of operation
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const data = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   3, // max retries
 *   1000 // 1 second initial delay
 * );
 * ```
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries = 3,
	delayMs = 1000,
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt === maxRetries) {
				throw lastError;
			}

			// Exponential backoff: delay * 2^attempt
			const backoffDelay = delayMs * Math.pow(2, attempt);

			logWarn(`Retry attempt ${attempt + 1}/${maxRetries} after ${backoffDelay}ms`, {
				error: lastError.message,
			});

			await new Promise((resolve) => setTimeout(resolve, backoffDelay));
		}
	}

	// This should never happen (loop always assigns lastError), but handle it safely
	throw lastError ?? new Error("Operation failed with unknown error");
}

/**
 * Error Boundary Component Props
 *
 * For React Error Boundaries
 */
export type ErrorBoundaryProps = {
	error: Error;
	reset: () => void;
};

/**
 * Error Classification
 *
 * Determines if an error is recoverable.
 *
 * @param error - Error to classify
 * @returns Whether the error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
	if (error instanceof AppError) {
		return error.isOperational;
	}

	// Network errors are usually recoverable
	if (error instanceof NetworkError) {
		return true;
	}

	// Validation and auth errors are recoverable
	if (
		error instanceof ValidationError ||
		error instanceof AuthenticationError ||
		error instanceof AuthorizationError
	) {
		return true;
	}

	// Unknown errors are not recoverable
	return false;
}

/**
 * Error Reporting
 *
 * Report errors to monitoring service (Sentry, etc.)
 *
 * @param error - Error to report
 * @param context - Additional context
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   reportError(error, {
 *     userId: currentUser.id,
 *     action: 'create_chat',
 *   });
 *   throw error;
 * }
 * ```
 */
export function reportError(
	error: unknown,
	context?: LogContext,
): void {
	// Always log with our structured logger
	// This handles environment differences automatically
	logError("Error reported", error, context);

	// In production, additional reporting to monitoring service
	// TODO: Integrate with Sentry or similar
	// if (typeof window !== 'undefined' && window.Sentry) {
	//   window.Sentry.captureException(error, {
	//     extra: context,
	//   });
	// }
}

/**
 * Best Practices
 *
 * DO:
 * - Use specific error types (ValidationError, NotFoundError, etc.)
 * - Include helpful error messages
 * - Log errors for debugging
 * - Return appropriate HTTP status codes
 * - Handle errors at appropriate levels
 * - Use try-catch for async operations
 *
 * DON'T:
 * - Expose sensitive information in error messages
 * - Swallow errors silently
 * - Return stack traces in production
 * - Use errors for control flow
 * - Catch errors too broadly
 * - Log errors multiple times
 *
 * LEVELS OF ERROR HANDLING:
 *
 * 1. Function Level
 *    - Throw specific error types
 *    - Let errors bubble up
 *
 * 2. Route Handler Level
 *    - Catch and convert to HTTP responses
 *    - Log for debugging
 *
 * 3. Error Boundary Level (React)
 *    - Catch rendering errors
 *    - Show user-friendly error UI
 *    - Offer recovery options
 *
 * 4. Global Error Handler
 *    - Catch unhandled errors
 *    - Log to monitoring service
 *    - Show generic error page
 */
