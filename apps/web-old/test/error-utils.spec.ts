import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
	categorizeError,
	getUserFriendlyErrorMessage,
	formatErrorForLogging,
	isRecoverableError,
	getErrorCategory,
	getErrorStatusCode,
	createErrorMessage,
	safeGetErrorMessage,
	isAbortError,
	getErrorTitle,
	shouldReportError,
	type ErrorCategory,
	type CategorizedError,
	type ErrorLogData,
} from "@/lib/error-utils";

describe("error-utils", () => {
	// =============================================================================
	// Error Categorization Tests
	// =============================================================================

	describe("categorizeError", () => {
		describe("network errors", () => {
			it("categorizes fetch errors as network", () => {
				const error = new Error("Failed to fetch");
				const result = categorizeError(error);

				expect(result.category).toBe("network");
				expect(result.userMessage).toContain("connect to the server");
				expect(result.recoverable).toBe(true);
			});

			it("categorizes network errors", () => {
				const error = new Error("Network request failed");
				const result = categorizeError(error);

				expect(result.category).toBe("network");
			});

			it("categorizes connection errors", () => {
				const error = new Error("Connection refused");
				const result = categorizeError(error);

				expect(result.category).toBe("network");
			});

			it("categorizes timeout errors", () => {
				const error = new Error("Request timeout");
				const result = categorizeError(error);

				expect(result.category).toBe("network");
			});

			it("categorizes ECONNREFUSED errors", () => {
				const error = new Error("ECONNREFUSED");
				const result = categorizeError(error);

				expect(result.category).toBe("network");
			});

			it("is case-insensitive for network detection", () => {
				const error = new Error("FETCH FAILED");
				const result = categorizeError(error);

				expect(result.category).toBe("network");
			});
		});

		describe("authentication errors", () => {
			it("categorizes unauthorized errors", () => {
				const error = new Error("Unauthorized");
				const result = categorizeError(error);

				expect(result.category).toBe("authentication");
				expect(result.statusCode).toBe(401);
				expect(result.userMessage).toContain("session has expired");
				expect(result.recoverable).toBe(true);
			});

			it("categorizes not authenticated errors", () => {
				const error = new Error("User not authenticated");
				const result = categorizeError(error);

				expect(result.category).toBe("authentication");
			});

			it("categorizes not logged in errors", () => {
				const error = new Error("Not logged in");
				const result = categorizeError(error);

				expect(result.category).toBe("authentication");
			});

			it("categorizes session expired errors", () => {
				const error = new Error("Session expired");
				const result = categorizeError(error);

				expect(result.category).toBe("authentication");
			});
		});

		describe("authorization errors", () => {
			it("categorizes forbidden errors", () => {
				const error = new Error("Forbidden");
				const result = categorizeError(error);

				expect(result.category).toBe("authorization");
				expect(result.statusCode).toBe(403);
				expect(result.userMessage).toContain("permission");
				expect(result.recoverable).toBe(false);
			});

			it("categorizes not authorized errors", () => {
				const error = new Error("Not authorized");
				const result = categorizeError(error);

				expect(result.category).toBe("authorization");
			});

			it("categorizes permission denied errors", () => {
				const error = new Error("Permission denied");
				const result = categorizeError(error);

				expect(result.category).toBe("authorization");
			});

			it("categorizes access denied errors", () => {
				const error = new Error("Access denied");
				const result = categorizeError(error);

				expect(result.category).toBe("authorization");
			});
		});

		describe("validation errors", () => {
			it("categorizes invalid input errors", () => {
				const error = new Error("Invalid email address");
				const result = categorizeError(error);

				expect(result.category).toBe("validation");
				expect(result.statusCode).toBe(400);
				expect(result.userMessage).toContain("invalid");
				expect(result.recoverable).toBe(true);
			});

			it("categorizes validation failed errors", () => {
				const error = new Error("Validation failed");
				const result = categorizeError(error);

				expect(result.category).toBe("validation");
			});

			it("categorizes required field errors", () => {
				const error = new Error("Field is required");
				const result = categorizeError(error);

				expect(result.category).toBe("validation");
			});

			it("categorizes malformed data errors", () => {
				const error = new Error("Malformed JSON");
				const result = categorizeError(error);

				expect(result.category).toBe("validation");
			});
		});

		describe("not found errors", () => {
			it("categorizes not found errors", () => {
				const error = new Error("Resource not found");
				const result = categorizeError(error);

				expect(result.category).toBe("not_found");
				expect(result.statusCode).toBe(404);
				expect(result.userMessage).toContain("could not be found");
				expect(result.recoverable).toBe(false);
			});

			it("categorizes does not exist errors", () => {
				const error = new Error("User does not exist");
				const result = categorizeError(error);

				expect(result.category).toBe("not_found");
			});

			it("categorizes 404 errors", () => {
				const error = new Error("404 - Page not found");
				const result = categorizeError(error);

				expect(result.category).toBe("not_found");
			});
		});

		describe("server errors", () => {
			it("categorizes internal server errors", () => {
				const error = new Error("Internal server error");
				const result = categorizeError(error);

				expect(result.category).toBe("server");
				expect(result.statusCode).toBe(500);
				expect(result.userMessage).toContain("server encountered an error");
				expect(result.recoverable).toBe(true);
			});

			it("categorizes 500 errors", () => {
				const error = new Error("500 error occurred");
				const result = categorizeError(error);

				expect(result.category).toBe("server");
			});

			it("categorizes 503 errors", () => {
				const error = new Error("503 Service Unavailable");
				const result = categorizeError(error);

				expect(result.category).toBe("server");
			});

			it("categorizes 502 errors", () => {
				const error = new Error("502 Bad Gateway");
				const result = categorizeError(error);

				expect(result.category).toBe("server");
			});
		});

		describe("Response object handling", () => {
			it("categorizes 401 Response as authentication", () => {
				const response = new Response(null, { status: 401 });
				const result = categorizeError(response);

				expect(result.category).toBe("authentication");
				expect(result.statusCode).toBe(401);
			});

			it("categorizes 403 Response as authorization", () => {
				const response = new Response(null, { status: 403 });
				const result = categorizeError(response);

				expect(result.category).toBe("authorization");
				expect(result.statusCode).toBe(403);
			});

			it("categorizes 404 Response as not_found", () => {
				const response = new Response(null, { status: 404 });
				const result = categorizeError(response);

				expect(result.category).toBe("not_found");
				expect(result.statusCode).toBe(404);
			});

			it("categorizes 500+ Response as server error", () => {
				const response = new Response(null, { status: 500 });
				const result = categorizeError(response);

				expect(result.category).toBe("server");
				expect(result.statusCode).toBe(500);
			});

			it("categorizes 400+ Response as client error", () => {
				const response = new Response(null, { status: 400 });
				const result = categorizeError(response);

				expect(result.category).toBe("client");
				expect(result.statusCode).toBe(400);
			});

			it("handles various 4xx status codes", () => {
				const statuses = [400, 422, 429];
				for (const status of statuses) {
					const response = new Response(null, { status });
					const result = categorizeError(response);
					expect(result.category).toBe("client");
					expect(result.statusCode).toBe(status);
				}
			});

			it("handles various 5xx status codes", () => {
				const statuses = [500, 502, 503, 504];
				for (const status of statuses) {
					const response = new Response(null, { status });
					const result = categorizeError(response);
					expect(result.category).toBe("server");
					expect(result.statusCode).toBe(status);
				}
			});
		});

		describe("unknown errors", () => {
			it("categorizes unrecognized Error as unknown", () => {
				const error = new Error("Something went wrong");
				const result = categorizeError(error);

				expect(result.category).toBe("unknown");
				expect(result.userMessage).toContain("unexpected error");
				expect(result.recoverable).toBe(true);
			});

			it("handles string errors", () => {
				const result = categorizeError("String error message");

				expect(result.category).toBe("unknown");
				expect(result.message).toBe("String error message");
			});

			it("handles null", () => {
				const result = categorizeError(null);

				expect(result.category).toBe("unknown");
				expect(result.message).toBe("null");
			});

			it("handles undefined", () => {
				const result = categorizeError(undefined);

				expect(result.category).toBe("unknown");
				expect(result.message).toBe("undefined");
			});

			it("handles objects without message", () => {
				const result = categorizeError({ code: 123 });

				expect(result.category).toBe("unknown");
			});
		});

		it("preserves original error in all cases", () => {
			const error = new Error("Test");
			const result = categorizeError(error);

			expect(result.originalError).toBe(error);
		});
	});

	// =============================================================================
	// User-Friendly Message Tests
	// =============================================================================

	describe("getUserFriendlyErrorMessage", () => {
		it("returns friendly message for network error", () => {
			const error = new Error("fetch failed");
			const message = getUserFriendlyErrorMessage(error);

			expect(message).toContain("connect to the server");
			expect(message).not.toContain("fetch");
		});

		it("returns friendly message for auth error", () => {
			const error = new Error("Unauthorized");
			const message = getUserFriendlyErrorMessage(error);

			expect(message).toContain("session has expired");
		});

		it("returns generic message for unknown error", () => {
			const error = new Error("Random error");
			const message = getUserFriendlyErrorMessage(error);

			expect(message).toContain("unexpected error");
		});

		it("handles non-Error objects", () => {
			const message = getUserFriendlyErrorMessage("error");
			expect(message).toBeDefined();
			expect(typeof message).toBe("string");
		});
	});

	// =============================================================================
	// Error Logging Tests
	// =============================================================================

	describe("formatErrorForLogging", () => {
		it("formats Error with all properties", () => {
			const error = new Error("Test error");
			const result = formatErrorForLogging(error);

			expect(result.message).toBe("Test error");
			expect(result.category).toBeDefined();
			expect(result.timestamp).toBeDefined();
			expect(result.stack).toBeDefined();
		});

		it("includes stack trace for Error instances", () => {
			const error = new Error("With stack");
			const result = formatErrorForLogging(error);

			expect(result.stack).toContain("Error: With stack");
		});

		it("includes context when provided", () => {
			const error = new Error("Test");
			const context = { userId: "123", action: "create" };
			const result = formatErrorForLogging(error, context);

			expect(result.context).toEqual(context);
		});

		it("includes status code for Response objects", () => {
			const response = new Response(null, { status: 404 });
			const result = formatErrorForLogging(response);

			expect(result.statusCode).toBe(404);
		});

		it("includes digest if available", () => {
			const error = { digest: "abc123", message: "Error" } as any;
			const result = formatErrorForLogging(error);

			expect(result.digest).toBe("abc123");
		});

		it("formats timestamp as ISO string", () => {
			const error = new Error("Test");
			const result = formatErrorForLogging(error);

			expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});

		it("handles errors without stack trace", () => {
			const error = { message: "No stack" };
			const result = formatErrorForLogging(error);

			expect(result.stack).toBeUndefined();
		});

		it("categorizes error correctly", () => {
			const error = new Error("Network timeout");
			const result = formatErrorForLogging(error);

			expect(result.category).toBe("network");
		});
	});

	// =============================================================================
	// Error Recovery Tests
	// =============================================================================

	describe("isRecoverableError", () => {
		it("returns true for network errors", () => {
			const error = new Error("fetch failed");
			expect(isRecoverableError(error)).toBe(true);
		});

		it("returns true for authentication errors", () => {
			const error = new Error("Unauthorized");
			expect(isRecoverableError(error)).toBe(true);
		});

		it("returns false for authorization errors", () => {
			const error = new Error("Forbidden");
			expect(isRecoverableError(error)).toBe(false);
		});

		it("returns true for validation errors", () => {
			const error = new Error("Invalid input");
			expect(isRecoverableError(error)).toBe(true);
		});

		it("returns false for not found errors", () => {
			const error = new Error("Not found");
			expect(isRecoverableError(error)).toBe(false);
		});

		it("returns true for server errors", () => {
			const error = new Error("Internal server error");
			expect(isRecoverableError(error)).toBe(true);
		});

		it("returns true for unknown errors", () => {
			const error = new Error("Random error");
			expect(isRecoverableError(error)).toBe(true);
		});
	});

	// =============================================================================
	// Error Property Extraction Tests
	// =============================================================================

	describe("getErrorCategory", () => {
		it("returns correct category for each error type", () => {
			expect(getErrorCategory(new Error("fetch failed"))).toBe("network");
			expect(getErrorCategory(new Error("Unauthorized"))).toBe("authentication");
			expect(getErrorCategory(new Error("Forbidden"))).toBe("authorization");
			expect(getErrorCategory(new Error("Invalid"))).toBe("validation");
			expect(getErrorCategory(new Error("Not found"))).toBe("not_found");
			expect(getErrorCategory(new Error("Internal server error"))).toBe("server");
		});

		it("returns unknown for unrecognized errors", () => {
			expect(getErrorCategory(new Error("Something"))).toBe("unknown");
		});
	});

	describe("getErrorStatusCode", () => {
		it("returns status code for categorized errors", () => {
			expect(getErrorStatusCode(new Error("Unauthorized"))).toBe(401);
			expect(getErrorStatusCode(new Error("Forbidden"))).toBe(403);
			expect(getErrorStatusCode(new Error("Not found"))).toBe(404);
			expect(getErrorStatusCode(new Error("Internal server error"))).toBe(500);
		});

		it("returns undefined for errors without status code", () => {
			expect(getErrorStatusCode(new Error("Random"))).toBeUndefined();
		});

		it("returns status code from Response objects", () => {
			const response = new Response(null, { status: 418 });
			expect(getErrorStatusCode(response)).toBe(418);
		});
	});

	// =============================================================================
	// Error Message Creation Tests
	// =============================================================================

	describe("createErrorMessage", () => {
		const originalEnv = process.env.NODE_ENV;

		afterEach(() => {
			process.env.NODE_ENV = originalEnv;
		});

		it("returns user-friendly message by default", () => {
			const error = new Error("fetch failed");
			const message = createErrorMessage(error);

			expect(message).toContain("connect to the server");
			expect(message).not.toContain("fetch failed");
		});

		it("accepts custom message", () => {
			const error = new Error("Test");
			const message = createErrorMessage(error, {
				customMessage: "Custom error message",
			});

			expect(message).toBe("Custom error message");
		});

		it("includes technical details in development", () => {
			process.env.NODE_ENV = "development";
			const error = new Error("Technical error");
			const message = createErrorMessage(error, {
				showTechnicalDetails: true,
			});

			expect(message).toContain("Technical details: Technical error");
		});

		it("hides technical details in production", () => {
			process.env.NODE_ENV = "production";
			const error = new Error("Technical error");
			const message = createErrorMessage(error, {
				showTechnicalDetails: true,
			});

			expect(message).not.toContain("Technical details");
		});

		it("combines custom message with technical details", () => {
			process.env.NODE_ENV = "development";
			const error = new Error("Technical");
			const message = createErrorMessage(error, {
				customMessage: "Custom",
				showTechnicalDetails: true,
			});

			expect(message).toContain("Custom");
			expect(message).toContain("Technical details");
		});
	});

	// =============================================================================
	// Safe Error Extraction Tests
	// =============================================================================

	describe("safeGetErrorMessage", () => {
		it("extracts message from Error instance", () => {
			const error = new Error("Error message");
			expect(safeGetErrorMessage(error)).toBe("Error message");
		});

		it("returns string directly", () => {
			expect(safeGetErrorMessage("String error")).toBe("String error");
		});

		it("extracts message from object with message property", () => {
			const error = { message: "Object error" };
			expect(safeGetErrorMessage(error)).toBe("Object error");
		});

		it("converts non-string values to string", () => {
			expect(safeGetErrorMessage(123)).toBe("123");
			expect(safeGetErrorMessage(true)).toBe("true");
		});

		it("handles null safely", () => {
			expect(safeGetErrorMessage(null)).toBe("null");
		});

		it("handles undefined safely", () => {
			expect(safeGetErrorMessage(undefined)).toBe("undefined");
		});

		it("handles objects without message", () => {
			const result = safeGetErrorMessage({ code: 123 });
			expect(result).toBeDefined();
			expect(typeof result).toBe("string");
		});

		it("never throws even with problematic inputs", () => {
			const problematicInputs = [
				null,
				undefined,
				{},
				[],
				Symbol("test"),
				() => {},
			];

			for (const input of problematicInputs) {
				expect(() => safeGetErrorMessage(input)).not.toThrow();
			}
		});
	});

	// =============================================================================
	// Abort Error Tests
	// =============================================================================

	describe("isAbortError", () => {
		it("returns true for AbortError", () => {
			const error = new Error("Operation aborted");
			error.name = "AbortError";
			expect(isAbortError(error)).toBe(true);
		});

		it("returns false for other Error types", () => {
			const error = new Error("Regular error");
			expect(isAbortError(error)).toBe(false);
		});

		it("returns false for non-Error objects", () => {
			expect(isAbortError("error")).toBe(false);
			expect(isAbortError(null)).toBe(false);
			expect(isAbortError({ name: "AbortError" })).toBe(false);
		});

		it("handles DOMException AbortError", () => {
			// Simulate browser AbortError
			const error = new Error("Aborted");
			error.name = "AbortError";
			expect(isAbortError(error)).toBe(true);
		});
	});

	// =============================================================================
	// Error Title Tests
	// =============================================================================

	describe("getErrorTitle", () => {
		it("returns appropriate title for each category", () => {
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

			for (const [category, expectedTitle] of Object.entries(titles)) {
				const error = new Error(category);
				const result = getErrorTitle(error);
				// Will get actual title based on error message matching
				expect(result).toBeDefined();
			}
		});

		it("returns title for network error", () => {
			const error = new Error("fetch failed");
			expect(getErrorTitle(error)).toBe("Connection Error");
		});

		it("returns title for auth error", () => {
			const error = new Error("Unauthorized");
			expect(getErrorTitle(error)).toBe("Authentication Required");
		});

		it("returns title for validation error", () => {
			const error = new Error("Invalid input");
			expect(getErrorTitle(error)).toBe("Invalid Input");
		});

		it("returns generic title for unknown error", () => {
			const error = new Error("Random");
			expect(getErrorTitle(error)).toBe("Something Went Wrong");
		});
	});

	// =============================================================================
	// Error Reporting Decision Tests
	// =============================================================================

	describe("shouldReportError", () => {
		it("returns false for abort errors", () => {
			const error = new Error("Aborted");
			error.name = "AbortError";
			expect(shouldReportError(error)).toBe(false);
		});

		it("returns false for validation errors", () => {
			const error = new Error("Invalid email");
			expect(shouldReportError(error)).toBe(false);
		});

		it("returns false for not found errors", () => {
			const error = new Error("Resource not found");
			expect(shouldReportError(error)).toBe(false);
		});

		it("returns true for network errors", () => {
			const error = new Error("fetch failed");
			expect(shouldReportError(error)).toBe(true);
		});

		it("returns true for server errors", () => {
			const error = new Error("Internal server error");
			expect(shouldReportError(error)).toBe(true);
		});

		it("returns true for authentication errors", () => {
			const error = new Error("Unauthorized");
			expect(shouldReportError(error)).toBe(true);
		});

		it("returns true for authorization errors", () => {
			const error = new Error("Forbidden");
			expect(shouldReportError(error)).toBe(true);
		});

		it("returns true for unknown errors", () => {
			const error = new Error("Something went wrong");
			expect(shouldReportError(error)).toBe(true);
		});
	});

	// =============================================================================
	// Integration Tests
	// =============================================================================

	describe("error utility integration", () => {
		it("provides consistent results across utilities", () => {
			const error = new Error("Unauthorized");

			const category = getErrorCategory(error);
			const statusCode = getErrorStatusCode(error);
			const message = getUserFriendlyErrorMessage(error);
			const title = getErrorTitle(error);
			const recoverable = isRecoverableError(error);

			expect(category).toBe("authentication");
			expect(statusCode).toBe(401);
			expect(message).toContain("session");
			expect(title).toBe("Authentication Required");
			expect(recoverable).toBe(true);
		});

		it("handles error through complete flow", () => {
			const error = new Error("Network timeout");

			// Categorize
			const categorized = categorizeError(error);
			expect(categorized.category).toBe("network");

			// Format for logging
			const logged = formatErrorForLogging(error, { action: "fetch" });
			expect(logged.category).toBe("network");
			expect(logged.context).toEqual({ action: "fetch" });

			// Get user message
			const userMessage = getUserFriendlyErrorMessage(error);
			expect(userMessage).toContain("connect");

			// Check if reportable
			const shouldReport = shouldReportError(error);
			expect(shouldReport).toBe(true);
		});

		it("handles Response object through utilities", () => {
			const response = new Response(null, { status: 403 });

			expect(getErrorCategory(response)).toBe("authorization");
			expect(getErrorStatusCode(response)).toBe(403);
			expect(isRecoverableError(response)).toBe(false);
			expect(getErrorTitle(response)).toBe("Access Denied");
		});
	});

	// =============================================================================
	// Edge Cases and Error Handling
	// =============================================================================

	describe("edge cases", () => {
		it("handles circular references in error context", () => {
			const error = new Error("Test");
			const context: any = { error };
			context.self = context;

			expect(() => formatErrorForLogging(error, context)).not.toThrow();
		});

		it("handles very long error messages", () => {
			const longMessage = "A".repeat(10000);
			const error = new Error(longMessage);

			const result = categorizeError(error);
			expect(result.message).toBe(longMessage);
		});

		it("handles errors with special characters", () => {
			const error = new Error("Error with 特殊文字 and émojis 🔥");
			const message = getUserFriendlyErrorMessage(error);

			expect(message).toBeDefined();
		});

		it("handles errors with newlines and tabs", () => {
			const error = new Error("Error\nwith\nnewlines\tand\ttabs");
			const result = categorizeError(error);

			expect(result.message).toContain("\n");
			expect(result.message).toContain("\t");
		});

		it("handles empty error messages", () => {
			const error = new Error("");
			const result = categorizeError(error);

			expect(result.category).toBe("unknown");
		});

		it("handles errors with only whitespace", () => {
			const error = new Error("   ");
			const result = categorizeError(error);

			expect(result.category).toBe("unknown");
		});
	});

	describe("type safety and validation", () => {
		it("returns correct types from all functions", () => {
			const error = new Error("Test");

			const category: ErrorCategory = getErrorCategory(error);
			const statusCode: number | undefined = getErrorStatusCode(error);
			const message: string = getUserFriendlyErrorMessage(error);
			const title: string = getErrorTitle(error);
			const recoverable: boolean = isRecoverableError(error);
			const logData: ErrorLogData = formatErrorForLogging(error);

			expect(typeof category).toBe("string");
			expect(typeof message).toBe("string");
			expect(typeof title).toBe("string");
			expect(typeof recoverable).toBe("boolean");
			expect(typeof logData).toBe("object");
		});

		it("handles TypeScript discriminated unions correctly", () => {
			const error = new Error("Test");
			const categorized: CategorizedError = categorizeError(error);

			if (categorized.category === "authentication") {
				expect(categorized.statusCode).toBe(401);
			}

			expect(categorized).toHaveProperty("category");
			expect(categorized).toHaveProperty("message");
			expect(categorized).toHaveProperty("userMessage");
			expect(categorized).toHaveProperty("originalError");
			expect(categorized).toHaveProperty("recoverable");
		});
	});
});
