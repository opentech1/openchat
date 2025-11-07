/**
 * Server-side production-safe logging utilities
 *
 * This module provides logging functions for server-side code that:
 * - Only log to console in development mode
 * - In production, errors are captured by Sentry automatically
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
 * Log warning messages
 * Warnings are logged in all environments as they may indicate issues
 */
export function logWarn(message: string, ...args: any[]) {
	if (isDevelopment || !isTest) {
		console.warn(message, ...args);
	}
}

/**
 * Log error messages
 * - In development: logs to console
 * - In production: Sentry automatically captures errors, so we suppress console output
 */
export function logError(message: string, error?: unknown, context?: Record<string, any>) {
	if (isDevelopment) {
		console.error(message, error, context);
	}
	// In production, @sentry/nextjs automatically captures errors
	// We can optionally use Sentry.captureException here for manual tracking
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
