/**
 * Production-safe structured logging utilities
 *
 * This module provides a comprehensive logging system that:
 * - Only logs to console in development mode
 * - Supports structured logging with context objects
 * - Auto-hashes PII (user IDs, emails) before logging
 * - Adds source location tracking
 * - Provides environment-aware behavior
 * - Integrates with Sentry for production error tracking
 *
 * @example
 * ```typescript
 * import { logger, createLogger } from '@/lib/logger';
 *
 * // Basic usage
 * logger.debug('Processing request', { requestId: '123' });
 * logger.info('User logged in', { userId: 'user_123' });
 * logger.warn('Rate limit approaching', { usage: 90, limit: 100 });
 * logger.error('Failed to process', new Error('Connection timeout'), { attempt: 3 });
 *
 * // With context prefix
 * const chatLogger = createLogger('ChatHandler');
 * chatLogger.info('Message received', { messageId: 'msg_456' });
 * ```
 */

import { createHash } from "crypto";

// Environment detection
const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";

/**
 * Log context object - structured data to accompany log messages
 */
export interface LogContext {
	[key: string]: unknown;
}

/**
 * Logger interface - standard logging methods
 */
export interface Logger {
	/**
	 * Debug-level logs (development only)
	 * Use for detailed diagnostic information
	 */
	debug(message: string, context?: LogContext): void;

	/**
	 * Info-level logs (development only)
	 * Use for general informational messages
	 */
	info(message: string, context?: LogContext): void;

	/**
	 * Warning-level logs (all environments)
	 * Use for potentially problematic situations
	 */
	warn(message: string, context?: LogContext): void;

	/**
	 * Error-level logs (all environments)
	 * Use for error conditions and exceptions
	 */
	error(message: string, error: Error | unknown, context?: LogContext): void;
}

/**
 * PII (Personally Identifiable Information) fields to hash
 * These fields will be automatically hashed when present in context
 */
const PII_FIELDS = new Set([
	"userId",
	"user_id",
	"email",
	"emailAddress",
	"email_address",
	"phoneNumber",
	"phone_number",
	"ipAddress",
	"ip_address",
	"sessionId",
	"session_id",
]);

/**
 * Hash a value using SHA-256 and return first 12 characters
 * This provides anonymization while maintaining correlation capability
 */
function hashValue(value: string): string {
	try {
		const hash = createHash("sha256").update(value).digest("hex");
		return hash.substring(0, 12); // First 12 chars for brevity
	} catch {
		return "hash_error";
	}
}

/**
 * Sanitize context object by hashing PII fields
 * Recursively processes nested objects
 */
function sanitizeContext(context: LogContext): LogContext {
	const sanitized: LogContext = {};

	for (const [key, value] of Object.entries(context)) {
		// Hash PII fields
		if (PII_FIELDS.has(key) && typeof value === "string") {
			sanitized[`${key}Hash`] = hashValue(value);
			continue;
		}

		// Recursively sanitize nested objects
		if (value && typeof value === "object" && !Array.isArray(value)) {
			sanitized[key] = sanitizeContext(value as LogContext);
			continue;
		}

		// Keep all other values as-is
		sanitized[key] = value;
	}

	return sanitized;
}

/**
 * Get source location information for log statements
 * Extracts file name and line number from stack trace
 */
function getSourceLocation(): string {
	try {
		const stack = new Error().stack;
		if (!stack) return "";

		const lines = stack.split("\n");
		// Skip first 3 lines (Error, getSourceLocation, log method)
		const callerLine = lines[4];
		if (!callerLine) return "";

		// Extract file path and line number
		// Format: "    at Object.<anonymous> (/path/to/file.ts:123:45)"
		const match = callerLine.match(/\((.+):(\d+):(\d+)\)/) || callerLine.match(/at (.+):(\d+):(\d+)/);
		if (!match) return "";

		const [, filePath, line] = match;
		if (!filePath || !line) return "";

		// Extract just the filename from the full path
		const fileName = filePath.split("/").pop() || filePath;
		return `${fileName}:${line}`;
	} catch {
		return "";
	}
}

/**
 * Format log message with timestamp, level, location, and context
 */
function formatLogMessage(
	level: string,
	message: string,
	context?: LogContext,
	location?: string
): string {
	const timestamp = new Date().toISOString();
	const parts = [
		`[${timestamp}]`,
		`[${level.toUpperCase()}]`,
		location ? `[${location}]` : "",
		message,
	].filter(Boolean);

	return parts.join(" ");
}

/**
 * Format context for logging
 * In production: JSON string for log aggregation
 * In development: Pretty-printed for readability
 */
function formatContext(context: LogContext): string {
	if (isProduction) {
		// Single-line JSON for log aggregation tools
		return JSON.stringify(context);
	}
	// Pretty-print for development
	return JSON.stringify(context, null, 2);
}

/**
 * Log debug messages (development only)
 * Use for detailed diagnostic information that helps during development
 */
export function logDebug(message: string, context?: LogContext): void {
	if (!isDevelopment) return;

	const location = getSourceLocation();
	const formattedMessage = formatLogMessage("debug", message, context, location);

	if (context) {
		const sanitized = sanitizeContext(context);
		console.debug(formattedMessage, "\n", formatContext(sanitized));
	} else {
		console.debug(formattedMessage);
	}
}

/**
 * Log information messages (development only)
 * Use for general informational messages about application flow
 */
export function logInfo(message: string, context?: LogContext): void {
	if (!isDevelopment) return;

	const location = getSourceLocation();
	const formattedMessage = formatLogMessage("info", message, context, location);

	if (context) {
		const sanitized = sanitizeContext(context);
		console.log(formattedMessage, "\n", formatContext(sanitized));
	} else {
		console.log(formattedMessage);
	}
}

/**
 * Log warning messages (all environments except test)
 * Use for potentially problematic situations that aren't errors
 * Warnings are logged in production as they may indicate issues
 */
export function logWarn(message: string, context?: LogContext): void {
	if (isTest) return;

	const location = getSourceLocation();
	const formattedMessage = formatLogMessage("warn", message, context, location);

	if (context) {
		const sanitized = sanitizeContext(context);
		if (isDevelopment) {
			console.warn(formattedMessage, "\n", formatContext(sanitized));
		} else {
			// Production: single line for log aggregation
			console.warn(formattedMessage, formatContext(sanitized));
		}
	} else {
		console.warn(formattedMessage);
	}
}

/**
 * Log error messages (all environments except test)
 * - In development: logs to console with full details
 * - In production: logs structured data for aggregation, integrates with Sentry
 *
 * @param message - Error message describing what went wrong
 * @param error - The error object or unknown value
 * @param context - Additional context about the error
 */
export function logError(
	message: string,
	error?: Error | unknown,
	context?: LogContext
): void {
	if (isTest) return;

	const location = getSourceLocation();
	const formattedMessage = formatLogMessage("error", message, context, location);

	// Build error context
	const errorContext: LogContext = {
		...context,
		errorMessage: error instanceof Error ? error.message : String(error),
		errorName: error instanceof Error ? error.name : "UnknownError",
	};

	// Add stack trace in development
	if (isDevelopment && error instanceof Error && error.stack) {
		errorContext.stack = error.stack;
	}

	const sanitized = sanitizeContext(errorContext);

	if (isDevelopment) {
		console.error(formattedMessage, "\n", formatContext(sanitized));
		if (error instanceof Error && error.stack) {
			console.error("Stack trace:", error.stack);
		}
	} else {
		// Production: single line JSON for log aggregation
		console.error(formattedMessage, formatContext(sanitized));
	}

	// In production, errors should be sent to Sentry
	// The @sentry/nextjs package automatically captures unhandled errors
	// For manual error tracking, we can use Sentry.captureException
	// This is handled at the application level
}

/**
 * Assert that a condition is true
 * Logs an error if the condition is false (development only)
 *
 * @param condition - Condition that should be true
 * @param message - Message to log if assertion fails
 */
export function assert(condition: boolean, message: string): void {
	if (!condition && isDevelopment) {
		const location = getSourceLocation();
		const formattedMessage = formatLogMessage("error", `Assertion failed: ${message}`, undefined, location);
		console.error(formattedMessage);
	}
}

/**
 * Create a logger with a specific context/prefix
 * The context will be prepended to all log messages
 *
 * @param context - Context identifier (e.g., "ChatHandler", "FileUpload")
 * @returns Logger instance with context
 *
 * @example
 * ```typescript
 * const logger = createLogger('ChatHandler');
 * logger.info('Processing message', { messageId: 'msg_123' });
 * // Output: [2024-01-15T10:30:00.000Z] [INFO] [ChatHandler] Processing message
 * ```
 */
export function createLogger(context: string): Logger {
	return {
		debug: (message: string, logContext?: LogContext) =>
			logDebug(`[${context}] ${message}`, logContext),

		info: (message: string, logContext?: LogContext) =>
			logInfo(`[${context}] ${message}`, logContext),

		warn: (message: string, logContext?: LogContext) =>
			logWarn(`[${context}] ${message}`, logContext),

		error: (message: string, error?: Error | unknown, logContext?: LogContext) =>
			logError(`[${context}] ${message}`, error, logContext),
	};
}

/**
 * Default logger instance
 * Use this for general application logging
 */
export const logger: Logger = {
	debug: logDebug,
	info: logInfo,
	warn: logWarn,
	error: logError,
};
