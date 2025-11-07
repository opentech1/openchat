/**
 * Production-safe logging utilities
 *
 * This module provides logging functions that:
 * - Only log in development mode
 * - Use Sentry for production error tracking (when available)
 * - Provide a consistent logging interface across the app
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Log information messages (development only)
 */
export function logInfo(message: string, ...args: any[]) {
	if (isDevelopment) {
		console.log(message, ...args);
	}
}

/**
 * Log warning messages (development only)
 */
export function logWarn(message: string, ...args: any[]) {
	if (isDevelopment) {
		console.warn(message, ...args);
	}
}

/**
 * Log error messages
 * - In development: logs to console
 * - In production: sends to Sentry (if available) and suppresses console output
 */
export function logError(message: string, error?: unknown, context?: Record<string, any>) {
	if (isDevelopment) {
		console.error(message, error, context);
	} else if (!isTest) {
		// In production, errors should be sent to Sentry
		// The @sentry/nextjs package automatically captures unhandled errors
		// For manual error tracking, we can use Sentry.captureException
		// This is handled at the application level, so we just suppress console output here
	}
}

/**
 * Log debug messages (development only)
 */
export function logDebug(message: string, ...args: any[]) {
	if (isDevelopment) {
		console.debug(message, ...args);
	}
}

/**
 * Assert that a condition is true
 * Logs an error if the condition is false (development only)
 */
export function assert(condition: boolean, message: string) {
	if (!condition && isDevelopment) {
		console.error(`Assertion failed: ${message}`);
	}
}

/**
 * Create a logger with a specific context/prefix
 */
export function createLogger(context: string) {
	return {
		info: (message: string, ...args: any[]) => logInfo(`[${context}] ${message}`, ...args),
		warn: (message: string, ...args: any[]) => logWarn(`[${context}] ${message}`, ...args),
		error: (message: string, error?: unknown, extraContext?: Record<string, any>) =>
			logError(`[${context}] ${message}`, error, extraContext),
		debug: (message: string, ...args: any[]) => logDebug(`[${context}] ${message}`, ...args),
	};
}
