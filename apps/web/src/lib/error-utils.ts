/**
 * Error utilities for consistent error handling across the application
 *
 * This module provides:
 * - Error categorization (network, auth, validation, etc.)
 * - User-friendly error message formatting
 * - Error logging preparation for error tracking services
 * - Type-safe error handling utilities
 */

export type ErrorCategory =
  | "network"
  | "authentication"
  | "authorization"
  | "validation"
  | "not_found"
  | "server"
  | "client"
  | "unknown";

export interface CategorizedError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  originalError: unknown;
  statusCode?: number;
  recoverable: boolean;
}

/**
 * Categorize an error based on its properties
 */
export function categorizeError(error: unknown): CategorizedError {
  // Handle Error instances
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("econnrefused")
    ) {
      return {
        category: "network",
        message: error.message,
        userMessage: "Unable to connect to the server. Please check your internet connection and try again.",
        originalError: error,
        recoverable: true,
      };
    }

    // Authentication errors
    if (
      message.includes("unauthorized") ||
      message.includes("not authenticated") ||
      message.includes("not logged in") ||
      message.includes("session expired")
    ) {
      return {
        category: "authentication",
        message: error.message,
        userMessage: "Your session has expired. Please log in again.",
        originalError: error,
        statusCode: 401,
        recoverable: true,
      };
    }

    // Authorization errors
    if (
      message.includes("forbidden") ||
      message.includes("not authorized") ||
      message.includes("permission denied") ||
      message.includes("access denied")
    ) {
      return {
        category: "authorization",
        message: error.message,
        userMessage: "You don't have permission to access this resource.",
        originalError: error,
        statusCode: 403,
        recoverable: false,
      };
    }

    // Validation errors
    if (
      message.includes("invalid") ||
      message.includes("validation") ||
      message.includes("required") ||
      message.includes("malformed")
    ) {
      return {
        category: "validation",
        message: error.message,
        userMessage: "The provided data is invalid. Please check your input and try again.",
        originalError: error,
        statusCode: 400,
        recoverable: true,
      };
    }

    // Not found errors
    if (
      message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("404")
    ) {
      return {
        category: "not_found",
        message: error.message,
        userMessage: "The requested resource could not be found.",
        originalError: error,
        statusCode: 404,
        recoverable: false,
      };
    }

    // Server errors
    if (
      message.includes("internal server error") ||
      message.includes("500") ||
      message.includes("503") ||
      message.includes("502")
    ) {
      return {
        category: "server",
        message: error.message,
        userMessage: "The server encountered an error. Please try again later.",
        originalError: error,
        statusCode: 500,
        recoverable: true,
      };
    }
  }

  // Handle Response objects
  if (error instanceof Response) {
    const statusCode = error.status;

    if (statusCode === 401) {
      return {
        category: "authentication",
        message: `Authentication failed (${statusCode})`,
        userMessage: "Your session has expired. Please log in again.",
        originalError: error,
        statusCode,
        recoverable: true,
      };
    }

    if (statusCode === 403) {
      return {
        category: "authorization",
        message: `Authorization failed (${statusCode})`,
        userMessage: "You don't have permission to access this resource.",
        originalError: error,
        statusCode,
        recoverable: false,
      };
    }

    if (statusCode === 404) {
      return {
        category: "not_found",
        message: `Resource not found (${statusCode})`,
        userMessage: "The requested resource could not be found.",
        originalError: error,
        statusCode,
        recoverable: false,
      };
    }

    if (statusCode >= 500) {
      return {
        category: "server",
        message: `Server error (${statusCode})`,
        userMessage: "The server encountered an error. Please try again later.",
        originalError: error,
        statusCode,
        recoverable: true,
      };
    }

    if (statusCode >= 400) {
      return {
        category: "client",
        message: `Client error (${statusCode})`,
        userMessage: "There was a problem with your request. Please try again.",
        originalError: error,
        statusCode,
        recoverable: true,
      };
    }
  }

  // Unknown error type
  return {
    category: "unknown",
    message: error instanceof Error ? error.message : String(error),
    userMessage: "An unexpected error occurred. Please try again.",
    originalError: error,
    recoverable: true,
  };
}

/**
 * Get a user-friendly error message from any error type
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const categorized = categorizeError(error);
  return categorized.userMessage;
}

/**
 * Format error for logging/tracking services
 */
export interface ErrorLogData {
  message: string;
  category: ErrorCategory;
  statusCode?: number;
  stack?: string;
  digest?: string;
  context?: Record<string, any>;
  timestamp: string;
  [key: string]: unknown; // Index signature for compatibility with LogContext
}

export function formatErrorForLogging(
  error: unknown,
  context?: Record<string, any>
): ErrorLogData {
  const categorized = categorizeError(error);
  const timestamp = new Date().toISOString();

  const logData: ErrorLogData = {
    message: categorized.message,
    category: categorized.category,
    statusCode: categorized.statusCode,
    timestamp,
    context,
  };

  // Add stack trace if available
  if (error instanceof Error && error.stack) {
    logData.stack = error.stack;
  }

  // Add digest if available (Next.js error digest)
  if (error && typeof error === "object" && "digest" in error) {
    logData.digest = String(error.digest);
  }

  return logData;
}

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverableError(error: unknown): boolean {
  const categorized = categorizeError(error);
  return categorized.recoverable;
}

/**
 * Get error category
 */
export function getErrorCategory(error: unknown): ErrorCategory {
  const categorized = categorizeError(error);
  return categorized.category;
}

/**
 * Get error status code if available
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  const categorized = categorizeError(error);
  return categorized.statusCode;
}

/**
 * Create a user-facing error message with optional technical details
 */
export function createErrorMessage(
  error: unknown,
  options?: {
    showTechnicalDetails?: boolean;
    customMessage?: string;
  }
): string {
  const categorized = categorizeError(error);
  const userMessage = options?.customMessage ?? categorized.userMessage;

  if (options?.showTechnicalDetails && process.env.NODE_ENV === "development") {
    return `${userMessage}\n\nTechnical details: ${categorized.message}`;
  }

  return userMessage;
}

/**
 * Safe error message extraction (never throws)
 */
export function safeGetErrorMessage(error: unknown): string {
  try {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    if (error && typeof error === "object" && "message" in error) {
      return String(error.message);
    }
    return String(error);
  } catch {
    return "Unknown error";
  }
}

/**
 * Check if error is an abort error (fetch cancelled)
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Get a short error title for UI display
 */
export function getErrorTitle(error: unknown): string {
  const category = getErrorCategory(error);

  const titles: Record<ErrorCategory, string> = {
    network: "Connection Error",
    authentication: "Authentication Required",
    authorization: "Access Denied",
    validation: "Invalid Input",
    not_found: "Not Found",
    server: "Server Error",
    client: "Request Error",
    unknown: "Something Went Wrong",
  };

  return titles[category];
}

/**
 * Determine if error should be reported to error tracking service
 */
export function shouldReportError(error: unknown): boolean {
  // Don't report abort errors (user cancelled)
  if (isAbortError(error)) {
    return false;
  }

  const category = getErrorCategory(error);

  // Don't report client validation errors
  if (category === "validation") {
    return false;
  }

  // Don't report 404 errors
  if (category === "not_found") {
    return false;
  }

  // Report all other errors
  return true;
}
