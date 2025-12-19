import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ZodError, z } from "zod";
import {
	AppError,
	ValidationError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	RateLimitError,
	NetworkError,
	DatabaseError,
	isApiError,
	isTextPart,
	isFilePart,
	errorToResponse,
	withErrorHandling,
	safeAsync,
	withRetry,
	isRecoverableError,
	reportError,
	type ApiError,
	type MessagePart,
	type TextPart,
	type FilePart,
	type ErrorResponse,
} from "@/lib/error-handling";

describe("error-handling", () => {
	// =============================================================================
	// Error Class Tests
	// =============================================================================

	describe("AppError", () => {
		it("creates basic AppError with all properties", () => {
			const error = new AppError("Test error", 500, "TEST_ERROR");
			expect(error.message).toBe("Test error");
			expect(error.statusCode).toBe(500);
			expect(error.code).toBe("TEST_ERROR");
			expect(error.isOperational).toBe(true);
			expect(error.name).toBe("AppError");
		});

		it("sets isOperational to false when specified", () => {
			const error = new AppError("Test error", 500, "TEST_ERROR", false);
			expect(error.isOperational).toBe(false);
		});

		it("captures stack trace", () => {
			const error = new AppError("Test error", 500, "TEST_ERROR");
			expect(error.stack).toBeDefined();
			expect(error.stack).toContain("AppError");
		});

		it("maintains prototype chain", () => {
			const error = new AppError("Test error", 500, "TEST_ERROR");
			expect(error instanceof AppError).toBe(true);
			expect(error instanceof Error).toBe(true);
		});
	});

	describe("ValidationError", () => {
		it("creates ValidationError with default status code 400", () => {
			const error = new ValidationError("Invalid input");
			expect(error.message).toBe("Invalid input");
			expect(error.statusCode).toBe(400);
			expect(error.code).toBe("VALIDATION_ERROR");
			expect(error.isOperational).toBe(true);
		});

		it("includes field errors when provided", () => {
			const fields = { email: "Invalid email", password: "Too short" };
			const error = new ValidationError("Validation failed", fields);
			expect(error.fields).toEqual(fields);
		});

		it("works without field errors", () => {
			const error = new ValidationError("Validation failed");
			expect(error.fields).toBeUndefined();
		});

		it("maintains ValidationError prototype chain", () => {
			const error = new ValidationError("Test");
			expect(error instanceof ValidationError).toBe(true);
			expect(error instanceof AppError).toBe(true);
			expect(error instanceof Error).toBe(true);
		});
	});

	describe("AuthenticationError", () => {
		it("creates AuthenticationError with default message", () => {
			const error = new AuthenticationError();
			expect(error.message).toBe("Authentication required");
			expect(error.statusCode).toBe(401);
			expect(error.code).toBe("AUTHENTICATION_ERROR");
		});

		it("accepts custom message", () => {
			const error = new AuthenticationError("Session expired");
			expect(error.message).toBe("Session expired");
		});

		it("is always operational", () => {
			const error = new AuthenticationError();
			expect(error.isOperational).toBe(true);
		});
	});

	describe("AuthorizationError", () => {
		it("creates AuthorizationError with default message", () => {
			const error = new AuthorizationError();
			expect(error.message).toBe("Insufficient permissions");
			expect(error.statusCode).toBe(403);
			expect(error.code).toBe("AUTHORIZATION_ERROR");
		});

		it("accepts custom message", () => {
			const error = new AuthorizationError("Admin access required");
			expect(error.message).toBe("Admin access required");
		});
	});

	describe("NotFoundError", () => {
		it("creates NotFoundError with resource name", () => {
			const error = new NotFoundError("User");
			expect(error.message).toBe("User not found");
			expect(error.statusCode).toBe(404);
			expect(error.code).toBe("NOT_FOUND_ERROR");
		});

		it("handles different resource names", () => {
			const chatError = new NotFoundError("Chat");
			expect(chatError.message).toBe("Chat not found");

			const messageError = new NotFoundError("Message");
			expect(messageError.message).toBe("Message not found");
		});
	});

	describe("RateLimitError", () => {
		it("creates RateLimitError with retry-after value", () => {
			const error = new RateLimitError(60);
			expect(error.message).toBe("Too many requests");
			expect(error.statusCode).toBe(429);
			expect(error.code).toBe("RATE_LIMIT_ERROR");
			expect(error.retryAfter).toBe(60);
		});

		it("handles different retry-after values", () => {
			const error1 = new RateLimitError(0);
			expect(error1.retryAfter).toBe(0);

			const error2 = new RateLimitError(3600);
			expect(error2.retryAfter).toBe(3600);
		});
	});

	describe("NetworkError", () => {
		it("creates NetworkError with message", () => {
			const error = new NetworkError("Connection timeout");
			expect(error.message).toBe("Connection timeout");
			expect(error.statusCode).toBe(503);
			expect(error.code).toBe("NETWORK_ERROR");
			expect(error.isOperational).toBe(true);
		});

		it("includes cause when provided", () => {
			const cause = new Error("ECONNREFUSED");
			const error = new NetworkError("Connection failed", cause);
			expect(error.cause).toBe(cause);
		});

		it("works without cause", () => {
			const error = new NetworkError("Timeout");
			expect(error.cause).toBeUndefined();
		});
	});

	describe("DatabaseError", () => {
		it("creates DatabaseError with message", () => {
			const error = new DatabaseError("Query failed");
			expect(error.message).toBe("Query failed");
			expect(error.statusCode).toBe(500);
			expect(error.code).toBe("DATABASE_ERROR");
		});

		it("is non-operational by default", () => {
			const error = new DatabaseError("Query failed");
			expect(error.isOperational).toBe(false);
		});

		it("includes cause when provided", () => {
			const cause = new Error("Connection pool exhausted");
			const error = new DatabaseError("Database error", cause);
			expect(error.cause).toBe(cause);
		});
	});

	// =============================================================================
	// Type Guard Tests
	// =============================================================================

	describe("isApiError", () => {
		it("returns true for object with API error properties", () => {
			const error: ApiError = { status: 500, message: "Error" };
			expect(isApiError(error)).toBe(true);
		});

		it("returns true for empty object", () => {
			expect(isApiError({})).toBe(true);
		});

		it("returns false for null", () => {
			expect(isApiError(null)).toBe(false);
		});

		it("returns false for undefined", () => {
			expect(isApiError(undefined)).toBe(false);
		});

		it("returns false for primitives", () => {
			expect(isApiError("error")).toBe(false);
			expect(isApiError(123)).toBe(false);
			expect(isApiError(true)).toBe(false);
		});

		it("returns true for Error instances", () => {
			expect(isApiError(new Error("test"))).toBe(true);
		});
	});

	describe("isTextPart", () => {
		it("returns true for valid text part", () => {
			const part: TextPart = { type: "text", text: "Hello" };
			expect(isTextPart(part)).toBe(true);
		});

		it("returns false for file part", () => {
			const part: FilePart = { type: "file", filename: "test.txt" };
			expect(isTextPart(part)).toBe(false);
		});

		it("returns false for missing text property", () => {
			const part = { type: "text" };
			expect(isTextPart(part)).toBe(false);
		});

		it("returns false for wrong type value", () => {
			const part = { type: "file", text: "hello" };
			expect(isTextPart(part)).toBe(false);
		});

		it("returns false for non-object", () => {
			expect(isTextPart(null)).toBe(false);
			expect(isTextPart("text")).toBe(false);
			expect(isTextPart(undefined)).toBe(false);
		});

		it("validates text is string", () => {
			const invalidPart = { type: "text", text: 123 };
			expect(isTextPart(invalidPart)).toBe(false);
		});
	});

	describe("isFilePart", () => {
		it("returns true for valid file part with filename", () => {
			const part: FilePart = { type: "file", filename: "test.txt" };
			expect(isFilePart(part)).toBe(true);
		});

		it("returns true for file part with data", () => {
			const part: FilePart = { type: "file", data: "base64data" };
			expect(isFilePart(part)).toBe(true);
		});

		it("returns true for file part with url", () => {
			const part: FilePart = { type: "file", url: "https://example.com/file.txt" };
			expect(isFilePart(part)).toBe(true);
		});

		it("returns false for text part", () => {
			const part: TextPart = { type: "text", text: "Hello" };
			expect(isFilePart(part)).toBe(false);
		});

		it("returns false for wrong type", () => {
			const part = { type: "other", data: "test" };
			expect(isFilePart(part)).toBe(false);
		});

		it("returns false for non-object", () => {
			expect(isFilePart(null)).toBe(false);
			expect(isFilePart(undefined)).toBe(false);
		});
	});

	// =============================================================================
	// Error Response Tests
	// =============================================================================

	describe("errorToResponse", () => {
		const originalEnv = process.env.NODE_ENV;

		beforeEach(() => {
			process.env.NODE_ENV = "test";
		});

		afterEach(() => {
			process.env.NODE_ENV = originalEnv;
		});

		it("converts AppError to Response", async () => {
			const error = new AppError("Test error", 500, "TEST_ERROR");
			const response = errorToResponse(error);

			expect(response.status).toBe(500);
			expect(response.headers.get("Content-Type")).toBe("application/json");

			const body = await response.json();
			expect(body).toEqual({
				error: "AppError",
				message: "Test error",
				code: "TEST_ERROR",
				statusCode: 500,
			});
		});

		it("includes field errors for ValidationError", async () => {
			const fields = { email: "Invalid email" };
			const error = new ValidationError("Validation failed", fields);
			const response = errorToResponse(error);

			const body = await response.json();
			expect(body.fields).toEqual(fields);
		});

		it("includes Retry-After header for RateLimitError", async () => {
			const error = new RateLimitError(60);
			const response = errorToResponse(error);

			expect(response.headers.get("Retry-After")).toBe("60");
			expect(response.status).toBe(429);
		});

		it("converts ZodError to ValidationError response", async () => {
			const schema = z.object({
				email: z.string().email(),
				age: z.number().min(18),
			});

			let zodError: ZodError;
			try {
				schema.parse({ email: "invalid", age: 10 });
			} catch (e) {
				zodError = e as ZodError;
			}

			const response = errorToResponse(zodError!);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.code).toBe("VALIDATION_ERROR");
			expect(body.fields).toBeDefined();
		});

		it("handles unknown errors with generic message in production", async () => {
			process.env.NODE_ENV = "production";
			const error = new Error("Database connection failed");
			const response = errorToResponse(error);

			const body = await response.json();
			expect(body.message).toBe("Internal server error");
			expect(body.statusCode).toBe(500);
		});

		it("shows detailed error message in development", async () => {
			process.env.NODE_ENV = "development";
			const error = new Error("Specific error details");
			const response = errorToResponse(error);

			const body = await response.json();
			expect(body.message).toBe("Specific error details");
		});

		it("handles non-Error objects", async () => {
			const response = errorToResponse("String error");
			const body = await response.json();

			expect(response.status).toBe(500);
			expect(body.message).toBeDefined();
		});
	});

	// =============================================================================
	// Error Handler Wrapper Tests
	// =============================================================================

	describe("withErrorHandling", () => {
		it("returns successful response when no error", async () => {
			const handler = withErrorHandling(async () => {
				return new Response(JSON.stringify({ success: true }), { status: 200 });
			});

			const response = await handler();
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
		});

		it("catches and converts errors to error response", async () => {
			const handler = withErrorHandling(async () => {
				throw new ValidationError("Invalid input");
			});

			const response = await handler();
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.code).toBe("VALIDATION_ERROR");
		});

		it("passes arguments to handler", async () => {
			const handler = withErrorHandling(async (arg1: string, arg2: number) => {
				return new Response(JSON.stringify({ arg1, arg2 }));
			});

			const response = await handler("test", 42);
			const body = await response.json();

			expect(body.arg1).toBe("test");
			expect(body.arg2).toBe(42);
		});

		it("handles async errors", async () => {
			const handler = withErrorHandling(async () => {
				await Promise.resolve();
				throw new NotFoundError("Resource");
			});

			const response = await handler();
			expect(response.status).toBe(404);
		});
	});

	// =============================================================================
	// Safe Async Tests
	// =============================================================================

	describe("safeAsync", () => {
		it("returns result on success", async () => {
			const result = await safeAsync(
				async () => "success",
				"Operation failed"
			);
			expect(result).toBe("success");
		});

		it("returns null on error", async () => {
			const result = await safeAsync(
				async () => {
					throw new Error("Failed");
				},
				"Operation failed"
			);
			expect(result).toBeNull();
		});

		it("handles resolved promises", async () => {
			const result = await safeAsync(
				async () => ({ data: "test" }),
				"Failed"
			);
			expect(result).toEqual({ data: "test" });
		});

		it("handles rejected promises", async () => {
			const result = await safeAsync(
				async () => Promise.reject(new Error("Rejected")),
				"Promise failed"
			);
			expect(result).toBeNull();
		});
	});

	// =============================================================================
	// Retry Logic Tests
	// =============================================================================

	describe("withRetry", () => {
		it("returns result on first success", async () => {
			const operation = vi.fn().mockResolvedValue("success");
			const result = await withRetry(operation, 3, 100);

			expect(result).toBe("success");
			expect(operation).toHaveBeenCalledTimes(1);
		});

		it("retries on failure and eventually succeeds", async () => {
			const operation = vi.fn()
				.mockRejectedValueOnce(new Error("Fail 1"))
				.mockRejectedValueOnce(new Error("Fail 2"))
				.mockResolvedValue("success");

			const result = await withRetry(operation, 3, 10);

			expect(result).toBe("success");
			expect(operation).toHaveBeenCalledTimes(3);
		});

		it("throws last error after all retries exhausted", async () => {
			const operation = vi.fn().mockRejectedValue(new Error("Always fails"));

			await expect(withRetry(operation, 2, 10)).rejects.toThrow("Always fails");
			expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
		});

		it("uses exponential backoff", async () => {
			const operation = vi.fn()
				.mockRejectedValueOnce(new Error("Fail 1"))
				.mockRejectedValueOnce(new Error("Fail 2"))
				.mockResolvedValue("success");

			const startTime = Date.now();
			await withRetry(operation, 2, 50);
			const duration = Date.now() - startTime;

			// First retry: 50ms, second retry: 100ms = 150ms total minimum
			expect(duration).toBeGreaterThanOrEqual(140);
		});

		it("handles non-Error rejections", async () => {
			const operation = vi.fn().mockRejectedValue("string error");

			await expect(withRetry(operation, 1, 10)).rejects.toThrow();
		});

		it("respects maxRetries parameter", async () => {
			const operation = vi.fn().mockRejectedValue(new Error("Fail"));

			await expect(withRetry(operation, 5, 10)).rejects.toThrow();
			expect(operation).toHaveBeenCalledTimes(6); // Initial + 5 retries
		});

		it("works with default parameters", async () => {
			const operation = vi.fn().mockResolvedValue("success");
			const result = await withRetry(operation);

			expect(result).toBe("success");
		});
	});

	// =============================================================================
	// Error Classification Tests
	// =============================================================================

	describe("isRecoverableError", () => {
		it("returns true for operational AppError", () => {
			const error = new AppError("Test", 500, "TEST", true);
			expect(isRecoverableError(error)).toBe(true);
		});

		it("returns false for non-operational AppError", () => {
			const error = new AppError("Test", 500, "TEST", false);
			expect(isRecoverableError(error)).toBe(false);
		});

		it("returns true for NetworkError", () => {
			const error = new NetworkError("Connection failed");
			expect(isRecoverableError(error)).toBe(true);
		});

		it("returns true for ValidationError", () => {
			const error = new ValidationError("Invalid input");
			expect(isRecoverableError(error)).toBe(true);
		});

		it("returns true for AuthenticationError", () => {
			const error = new AuthenticationError();
			expect(isRecoverableError(error)).toBe(true);
		});

		it("returns true for AuthorizationError", () => {
			const error = new AuthorizationError();
			expect(isRecoverableError(error)).toBe(true);
		});

		it("returns false for unknown errors", () => {
			expect(isRecoverableError(new Error("Unknown"))).toBe(false);
			expect(isRecoverableError("string error")).toBe(false);
			expect(isRecoverableError(null)).toBe(false);
		});

		it("returns false for DatabaseError", () => {
			const error = new DatabaseError("Query failed");
			expect(isRecoverableError(error)).toBe(false);
		});
	});

	// =============================================================================
	// Error Reporting Tests
	// =============================================================================

	describe("reportError", () => {
		it("reports error without context", () => {
			const error = new Error("Test error");
			expect(() => reportError(error)).not.toThrow();
		});

		it("reports error with context", () => {
			const error = new Error("Test error");
			const context = { userId: "123", action: "create_chat" };
			expect(() => reportError(error, context)).not.toThrow();
		});

		it("handles non-Error objects", () => {
			expect(() => reportError("string error")).not.toThrow();
			expect(() => reportError(null)).not.toThrow();
			expect(() => reportError({ message: "object error" })).not.toThrow();
		});

		it("handles AppError instances", () => {
			const error = new ValidationError("Invalid input");
			expect(() => reportError(error, { field: "email" })).not.toThrow();
		});
	});

	// =============================================================================
	// Integration and Edge Case Tests
	// =============================================================================

	describe("error handling integration", () => {
		it("chains multiple error handling utilities", async () => {
			const operation = vi.fn()
				.mockRejectedValueOnce(new NetworkError("Timeout"))
				.mockResolvedValue({ data: "success" });

			const handler = withErrorHandling(async () => {
				const result = await withRetry(operation, 2, 10);
				return new Response(JSON.stringify(result));
			});

			const response = await handler();
			expect(response.status).toBe(200);
		});

		it("handles nested errors correctly", async () => {
			const innerError = new ValidationError("Inner error");
			const outerError = new NetworkError("Outer error", innerError);

			const response = errorToResponse(outerError);
			expect(response.status).toBe(503);
		});

		it("preserves error properties through conversions", async () => {
			const fields = { email: "invalid", name: "required" };
			const error = new ValidationError("Multiple errors", fields);

			const response = errorToResponse(error);
			const body = await response.json();

			expect(body.fields).toEqual(fields);
			expect(body.code).toBe("VALIDATION_ERROR");
		});
	});

	describe("stack trace handling", () => {
		it("includes stack trace for all custom errors", () => {
			const errors = [
				new AppError("Test", 500, "TEST"),
				new ValidationError("Test"),
				new AuthenticationError(),
				new AuthorizationError(),
				new NotFoundError("Resource"),
				new NetworkError("Test"),
				new DatabaseError("Test"),
			];

			for (const error of errors) {
				expect(error.stack).toBeDefined();
				expect(error.stack).toContain(error.name);
			}
		});

		it("stack trace points to error origin", () => {
			const error = new ValidationError("Test error");
			expect(error.stack).toContain("error-handling.spec.ts");
		});
	});

	describe("error message sanitization", () => {
		const originalEnv = process.env.NODE_ENV;

		afterEach(() => {
			process.env.NODE_ENV = originalEnv;
		});

		it("does not expose sensitive information in production", async () => {
			process.env.NODE_ENV = "production";
			const error = new Error("Database password: secret123");

			const response = errorToResponse(error);
			const body = await response.json();

			expect(body.message).toBe("Internal server error");
			expect(body.message).not.toContain("secret123");
		});

		it("shows detailed errors in development", async () => {
			process.env.NODE_ENV = "development";
			const error = new Error("Detailed technical error");

			const response = errorToResponse(error);
			const body = await response.json();

			expect(body.message).toBe("Detailed technical error");
		});
	});

	describe("message part type guards edge cases", () => {
		it("handles empty string in text part", () => {
			const part: TextPart = { type: "text", text: "" };
			expect(isTextPart(part)).toBe(true);
		});

		it("handles file part with all optional fields", () => {
			const part: FilePart = {
				type: "file",
				data: "base64",
				url: "https://example.com",
				filename: "test.txt",
				mediaType: "text/plain",
			};
			expect(isFilePart(part)).toBe(true);
		});

		it("rejects malformed parts", () => {
			expect(isTextPart({ type: "text", content: "wrong field" })).toBe(false);
			expect(isFilePart({ type: "file" })).toBe(true); // All fields optional
		});
	});
});
