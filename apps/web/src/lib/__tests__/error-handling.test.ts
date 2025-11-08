/**
 * Unit Tests for Error Handling
 *
 * Tests custom error classes, error conversion, and error handling patterns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	AppError,
	ValidationError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	RateLimitError,
	NetworkError,
	DatabaseError,
	errorToResponse,
	withErrorHandling,
	safeAsync,
	withRetry,
	isRecoverableError,
	reportError,
} from "../error-handling";
import { ZodError, z } from "zod";

describe("AppError", () => {
	it("should create error with all properties", () => {
		// Arrange & Act
		const error = new AppError("Test error", 500, "TEST_ERROR");

		// Assert
		expect(error.message).toBe("Test error");
		expect(error.statusCode).toBe(500);
		expect(error.code).toBe("TEST_ERROR");
		expect(error.isOperational).toBe(true);
		expect(error.name).toBe("AppError");
	});

	it("should support non-operational errors", () => {
		// Arrange & Act
		const error = new AppError("Critical error", 500, "CRITICAL", false);

		// Assert
		expect(error.isOperational).toBe(false);
	});

	it("should capture stack trace", () => {
		// Arrange & Act
		const error = new AppError("Test", 500, "TEST");

		// Assert
		expect(error.stack).toBeDefined();
	});
});

describe("ValidationError", () => {
	it("should create validation error", () => {
		// Arrange & Act
		const error = new ValidationError("Invalid input");

		// Assert
		expect(error.message).toBe("Invalid input");
		expect(error.statusCode).toBe(400);
		expect(error.code).toBe("VALIDATION_ERROR");
	});

	it("should include field errors", () => {
		// Arrange & Act
		const fields = { email: "Invalid email", name: "Name is required" };
		const error = new ValidationError("Validation failed", fields);

		// Assert
		expect(error.fields).toEqual(fields);
	});
});

describe("AuthenticationError", () => {
	it("should create auth error with default message", () => {
		// Arrange & Act
		const error = new AuthenticationError();

		// Assert
		expect(error.message).toBe("Authentication required");
		expect(error.statusCode).toBe(401);
		expect(error.code).toBe("AUTHENTICATION_ERROR");
	});

	it("should create auth error with custom message", () => {
		// Arrange & Act
		const error = new AuthenticationError("Invalid token");

		// Assert
		expect(error.message).toBe("Invalid token");
	});
});

describe("AuthorizationError", () => {
	it("should create authz error with default message", () => {
		// Arrange & Act
		const error = new AuthorizationError();

		// Assert
		expect(error.message).toBe("Insufficient permissions");
		expect(error.statusCode).toBe(403);
		expect(error.code).toBe("AUTHORIZATION_ERROR");
	});

	it("should create authz error with custom message", () => {
		// Arrange & Act
		const error = new AuthorizationError("Admin access required");

		// Assert
		expect(error.message).toBe("Admin access required");
	});
});

describe("NotFoundError", () => {
	it("should create not found error", () => {
		// Arrange & Act
		const error = new NotFoundError("User");

		// Assert
		expect(error.message).toBe("User not found");
		expect(error.statusCode).toBe(404);
		expect(error.code).toBe("NOT_FOUND_ERROR");
	});
});

describe("RateLimitError", () => {
	it("should create rate limit error", () => {
		// Arrange & Act
		const error = new RateLimitError(60);

		// Assert
		expect(error.message).toBe("Too many requests");
		expect(error.statusCode).toBe(429);
		expect(error.code).toBe("RATE_LIMIT_ERROR");
		expect(error.retryAfter).toBe(60);
	});
});

describe("NetworkError", () => {
	it("should create network error", () => {
		// Arrange & Act
		const error = new NetworkError("API request failed");

		// Assert
		expect(error.message).toBe("API request failed");
		expect(error.statusCode).toBe(503);
		expect(error.code).toBe("NETWORK_ERROR");
	});

	it("should include cause", () => {
		// Arrange
		const cause = new Error("Connection timeout");

		// Act
		const error = new NetworkError("Failed to connect", cause);

		// Assert
		expect(error.cause).toBe(cause);
	});
});

describe("DatabaseError", () => {
	it("should create database error", () => {
		// Arrange & Act
		const error = new DatabaseError("Query failed");

		// Assert
		expect(error.message).toBe("Query failed");
		expect(error.statusCode).toBe(500);
		expect(error.code).toBe("DATABASE_ERROR");
		expect(error.isOperational).toBe(false);
	});
});

describe("errorToResponse", () => {
	const originalEnv = process.env.NODE_ENV;

	afterEach(() => {
		process.env.NODE_ENV = originalEnv;
	});

	it("should convert AppError to response", async () => {
		// Arrange
		const error = new ValidationError("Invalid input");

		// Act
		const response = errorToResponse(error);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(body.error).toBe("ValidationError");
		expect(body.message).toBe("Invalid input");
		expect(body.code).toBe("VALIDATION_ERROR");
	});

	it("should include field errors in validation response", async () => {
		// Arrange
		const fields = { email: "Invalid email" };
		const error = new ValidationError("Validation failed", fields);

		// Act
		const response = errorToResponse(error);
		const body = await response.json();

		// Assert
		expect(body.fields).toEqual(fields);
	});

	it("should include Retry-After header for rate limit errors", () => {
		// Arrange
		const error = new RateLimitError(60);

		// Act
		const response = errorToResponse(error);

		// Assert
		expect(response.headers.get("Retry-After")).toBe("60");
	});

	it("should convert ZodError to ValidationError", async () => {
		// Arrange
		const schema = z.object({ email: z.string().email() });
		let zodError: ZodError | null = null;

		try {
			schema.parse({ email: "invalid" });
		} catch (error) {
			zodError = error as ZodError;
		}

		// Act
		const response = errorToResponse(zodError!);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(body.code).toBe("VALIDATION_ERROR");
		expect(body.fields).toBeDefined();
	});

	it("should handle unknown errors in development", async () => {
		// Arrange
		process.env.NODE_ENV = "development";
		const error = new Error("Test error");

		// Act
		const response = errorToResponse(error);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(500);
		expect(body.message).toBe("Test error");
	});

	it("should hide details in production", async () => {
		// Arrange
		process.env.NODE_ENV = "production";
		const error = new Error("Sensitive info");

		// Act
		const response = errorToResponse(error);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(500);
		expect(body.message).toBe("Internal server error");
		expect(body.message).not.toContain("Sensitive");
	});

	it("should set Content-Type header", () => {
		// Arrange
		const error = new ValidationError("Test");

		// Act
		const response = errorToResponse(error);

		// Assert
		expect(response.headers.get("Content-Type")).toBe("application/json");
	});
});

describe("withErrorHandling", () => {
	it("should return response when no error", async () => {
		// Arrange
		const handler = async () =>
			new Response(JSON.stringify({ success: true }), { status: 200 });
		const wrapped = withErrorHandling(handler);

		// Act
		const response = await wrapped();
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body.success).toBe(true);
	});

	it("should catch and convert errors", async () => {
		// Arrange
		const handler = async () => {
			throw new ValidationError("Invalid input");
		};
		const wrapped = withErrorHandling(handler);

		// Act
		const response = await wrapped();
		const body = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(body.code).toBe("VALIDATION_ERROR");
	});

	it("should pass through arguments", async () => {
		// Arrange
		const handler = async (request: Request) => {
			const body = await request.json();
			return new Response(JSON.stringify({ received: body }), {
				status: 200,
			});
		};
		const wrapped = withErrorHandling(handler);
		const request = new Request("http://localhost", {
			method: "POST",
			body: JSON.stringify({ test: "data" }),
		});

		// Act
		const response = await wrapped(request);
		const body = await response.json();

		// Assert
		expect(body.received).toEqual({ test: "data" });
	});
});

describe("safeAsync", () => {
	it("should return result on success", async () => {
		// Arrange
		const operation = async () => "success";

		// Act
		const result = await safeAsync(operation, "Failed");

		// Assert
		expect(result).toBe("success");
	});

	it("should return null on error", async () => {
		// Arrange
		const operation = async () => {
			throw new Error("Test error");
		};

		// Act
		const result = await safeAsync(operation, "Failed");

		// Assert
		expect(result).toBeNull();
	});

	it("should handle rejected promises", async () => {
		// Arrange
		const operation = () => Promise.reject(new Error("Rejected"));

		// Act
		const result = await safeAsync(operation, "Failed");

		// Assert
		expect(result).toBeNull();
	});
});

describe("withRetry", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should return result on first try", async () => {
		// Arrange
		const operation = vi.fn(() => Promise.resolve("success"));

		// Act
		const result = await withRetry(operation, 3, 1000);

		// Assert
		expect(result).toBe("success");
		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("should retry on failure", async () => {
		// Arrange
		let attempts = 0;
		const operation = vi.fn(async () => {
			attempts++;
			if (attempts < 3) {
				throw new Error("Temporary error");
			}
			return "success";
		});

		// Act
		const promise = withRetry(operation, 3, 100);

		// Advance timers for each retry
		await vi.runAllTimersAsync();

		const result = await promise;

		// Assert
		expect(result).toBe("success");
		expect(operation).toHaveBeenCalledTimes(3);
	});

	it("should throw after max retries", async () => {
		// Arrange
		const operation = vi.fn(() =>
			Promise.reject(new Error("Persistent error")),
		);

		// Act & Assert
		const promise = withRetry(operation, 2, 100);

		await vi.runAllTimersAsync();

		await expect(promise).rejects.toThrow("Persistent error");
		expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
	});

	it("should use exponential backoff", async () => {
		// Arrange
		const delays: number[] = [];
		vi.spyOn(global, "setTimeout").mockImplementation(
			((callback: () => void, delay: number) => {
				delays.push(delay);
				callback();
				return 1 as any;
			}) as any,
		);

		const operation = vi.fn(() =>
			Promise.reject(new Error("Test error")),
		);

		// Act
		try {
			await withRetry(operation, 3, 1000);
		} catch {}

		// Assert - delays should be 1000, 2000, 4000
		expect(delays[0]).toBe(1000);
		expect(delays[1]).toBe(2000);
		expect(delays[2]).toBe(4000);
	});
});

describe("isRecoverableError", () => {
	it("should identify operational errors as recoverable", () => {
		// Arrange
		const error = new ValidationError("Invalid input");

		// Act & Assert
		expect(isRecoverableError(error)).toBe(true);
	});

	it("should identify non-operational errors as not recoverable", () => {
		// Arrange
		const error = new DatabaseError("Database down");

		// Act & Assert
		expect(isRecoverableError(error)).toBe(false);
	});

	it("should identify authentication errors as recoverable", () => {
		// Arrange
		const error = new AuthenticationError();

		// Act & Assert
		expect(isRecoverableError(error)).toBe(true);
	});

	it("should identify authorization errors as recoverable", () => {
		// Arrange
		const error = new AuthorizationError();

		// Act & Assert
		expect(isRecoverableError(error)).toBe(true);
	});

	it("should identify network errors as recoverable", () => {
		// Arrange
		const error = new NetworkError("Connection failed");

		// Act & Assert
		expect(isRecoverableError(error)).toBe(true);
	});

	it("should identify unknown errors as not recoverable", () => {
		// Arrange
		const error = new Error("Unknown error");

		// Act & Assert
		expect(isRecoverableError(error)).toBe(false);
	});
});

describe("reportError", () => {
	const originalEnv = process.env.NODE_ENV;
	const consoleSpy = vi.spyOn(console, "error");

	beforeEach(() => {
		consoleSpy.mockClear();
	});

	afterEach(() => {
		process.env.NODE_ENV = originalEnv;
		consoleSpy.mockRestore();
	});

	it("should log to console in development", () => {
		// Arrange
		process.env.NODE_ENV = "development";
		const error = new Error("Test error");
		const context = { userId: "123" };

		// Act
		reportError(error, context);

		// Assert
		expect(consoleSpy).toHaveBeenCalledWith(
			"Error reported:",
			error,
			context,
		);
	});

	it("should not log to console in production", () => {
		// Arrange
		process.env.NODE_ENV = "production";
		const error = new Error("Test error");

		// Act
		reportError(error);

		// Assert - console.error might be called by logger, but not with "Error reported:"
		const calls = consoleSpy.mock.calls;
		const hasReportedCall = calls.some((call) =>
			call.includes("Error reported:"),
		);
		expect(hasReportedCall).toBe(false);
	});

	it("should handle errors without context", () => {
		// Arrange
		process.env.NODE_ENV = "development";
		const error = new Error("Test error");

		// Act & Assert - Should not throw
		expect(() => reportError(error)).not.toThrow();
	});
});
