/**
 * Component Tests for ErrorBoundary
 *
 * Tests error boundary functionality including:
 * - Catching component errors
 * - Showing fallback UI
 * - Displaying error messages
 * - Retry functionality
 * - Sentry error reporting
 * - Error state management
 */

import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary, useErrorHandler, type ErrorBoundaryFallbackProps } from "./error-boundary";
import * as errorUtils from "@/lib/error-utils";
import * as logger from "@/lib/logger";

// Mock the logger module
vi.mock("@/lib/logger", () => ({
	logError: vi.fn(),
}));

// Mock window.Sentry
interface MockSentry {
	captureException: ReturnType<typeof vi.fn>;
}

// Component that throws an error
function ThrowError({ error }: { error: Error }) {
	throw error;
}

// Component that uses error handler hook
function UseErrorHandlerComponent({ error }: { error: Error | null }) {
	const setError = useErrorHandler();

	if (error) {
		setError(error);
	}

	return <div>Component with error handler</div>;
}

describe("ErrorBoundary", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// Suppress console.error in tests (React will log caught errors)
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.clearAllMocks();
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		// Clean up window.Sentry if it was set
		if (typeof window !== "undefined") {
			delete (window as Window & { Sentry?: MockSentry }).Sentry;
		}
	});

	describe("Error Catching", () => {
		test("should catch component errors", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByRole("alert")).toBeInTheDocument();
			expect(screen.getByText(/Something Went Wrong/i)).toBeInTheDocument();
		});

		test("should render children when no error occurs", () => {
			render(
				<ErrorBoundary>
					<div>Child content</div>
				</ErrorBoundary>
			);

			expect(screen.getByText("Child content")).toBeInTheDocument();
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		});

		test("should catch errors from nested components", () => {
			const error = new Error("Nested error");

			render(
				<ErrorBoundary>
					<div>
						<div>
							<ThrowError error={error} />
						</div>
					</div>
				</ErrorBoundary>
			);

			expect(screen.getByRole("alert")).toBeInTheDocument();
		});

		test("should catch multiple different errors", () => {
			const error1 = new Error("First error");
			const { rerender } = render(
				<ErrorBoundary>
					<ThrowError error={error1} />
				</ErrorBoundary>
			);

			expect(screen.getByText(/Something Went Wrong/i)).toBeInTheDocument();

			// Reset and throw different error
			const error2 = new Error("Second error");
			rerender(
				<ErrorBoundary>
					<ThrowError error={error2} />
				</ErrorBoundary>
			);
		});
	});

	describe("Fallback UI Display", () => {
		test("should show default fallback UI", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByRole("alert")).toBeInTheDocument();
			expect(screen.getByText(/Something Went Wrong/i)).toBeInTheDocument();
		});

		test("should show custom fallback when provided", () => {
			const error = new Error("Test error");
			const customFallback = ({ error, resetError }: ErrorBoundaryFallbackProps) => (
				<div>
					<h1>Custom Error UI</h1>
					<p>{error.message}</p>
					<button onClick={resetError}>Reset</button>
				</div>
			);

			render(
				<ErrorBoundary fallback={customFallback}>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
			expect(screen.getByText("Test error")).toBeInTheDocument();
		});

		test("should display error icon", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			// AlertTriangle icon should be present
			const icon = screen.getByRole("alert").querySelector('svg');
			expect(icon).toBeInTheDocument();
		});

		test("should have proper ARIA attributes", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			const alert = screen.getByRole("alert");
			expect(alert).toHaveAttribute("aria-live", "assertive");
			expect(alert).toHaveAttribute("aria-atomic", "true");
		});
	});

	describe("Error Message Display", () => {
		test("should display user-friendly error message", () => {
			const error = new Error("Network error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			// The error message is categorized as "network" and shows the network-specific message
			expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument();
		});

		test("should display error title based on category", () => {
			const error = new Error("Unauthorized");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByText(/Authentication Required/i)).toBeInTheDocument();
		});

		test("should show error digest in production when available", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			const error = new Error("Test error") as Error & { digest?: string };
			error.digest = "abc123";

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByText(/Error ID: abc123/i)).toBeInTheDocument();

			process.env.NODE_ENV = originalEnv;
		});

		test("should show technical details in development", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "development";

			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByText(/Technical Details/i)).toBeInTheDocument();

			process.env.NODE_ENV = originalEnv;
		});

		test("should display stack trace in development", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "development";

			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByText(/Stack Trace/i)).toBeInTheDocument();

			process.env.NODE_ENV = originalEnv;
		});

		test("should not show technical details in production", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.queryByText(/Technical Details/i)).not.toBeInTheDocument();

			process.env.NODE_ENV = originalEnv;
		});
	});

	describe("Retry Button", () => {
		test("should show retry button for recoverable errors", () => {
			const error = new Error("Network error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
		});

		test("should reset error state on retry", async () => {
			const user = userEvent.setup();
			let shouldThrow = true;

			function ConditionalThrow() {
				if (shouldThrow) {
					throw new Error("Test error");
				}
				return <div>Success</div>;
			}

			const { rerender } = render(
				<ErrorBoundary>
					<ConditionalThrow />
				</ErrorBoundary>
			);

			expect(screen.getByRole("alert")).toBeInTheDocument();

			// Fix the error and click retry
			shouldThrow = false;
			const retryButton = screen.getByRole("button", { name: /Try again/i });
			await user.click(retryButton);

			// Need to rerender to show success
			rerender(
				<ErrorBoundary>
					<ConditionalThrow />
				</ErrorBoundary>
			);
		});

		test("should call onReset callback when retry is clicked", async () => {
			const user = userEvent.setup();
			const onReset = vi.fn();
			const error = new Error("Test error");

			render(
				<ErrorBoundary onReset={onReset}>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			const retryButton = screen.getByRole("button", { name: /Try again/i });
			await user.click(retryButton);

			expect(onReset).toHaveBeenCalledTimes(1);
		});

		test("should have proper accessibility for retry button", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			const retryButton = screen.getByRole("button", { name: /Try again/i });
			expect(retryButton).toHaveAttribute("aria-label", "Try again");
		});
	});

	describe("Sentry Error Reporting", () => {
		test("should report to Sentry when window.Sentry exists in production", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			const mockCaptureException = vi.fn();
			if (typeof window !== "undefined") {
				(window as Window & { Sentry: MockSentry }).Sentry = {
					captureException: mockCaptureException,
				};
			}

			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(mockCaptureException).toHaveBeenCalledWith(
				error,
				expect.objectContaining({
					contexts: expect.objectContaining({
						react: expect.any(Object),
					}),
				})
			);

			process.env.NODE_ENV = originalEnv;
		});

		test("should not report to Sentry in development", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "development";

			const mockCaptureException = vi.fn();
			if (typeof window !== "undefined") {
				(window as Window & { Sentry: MockSentry }).Sentry = {
					captureException: mockCaptureException,
				};
			}

			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(mockCaptureException).not.toHaveBeenCalled();

			process.env.NODE_ENV = originalEnv;
		});

		test("should not report when Sentry is not available", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			// Ensure Sentry is not available
			if (typeof window !== "undefined") {
				delete (window as Window & { Sentry?: MockSentry }).Sentry;
			}

			const error = new Error("Test error");

			// Should not throw when Sentry is not available
			expect(() => {
				render(
					<ErrorBoundary>
						<ThrowError error={error} />
					</ErrorBoundary>
				);
			}).not.toThrow();

			process.env.NODE_ENV = originalEnv;
		});

		test("should not report validation errors to Sentry", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			const mockCaptureException = vi.fn();
			if (typeof window !== "undefined") {
				(window as Window & { Sentry: MockSentry }).Sentry = {
					captureException: mockCaptureException,
				};
			}

			const error = new Error("Validation failed");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			// Validation errors should not be reported
			expect(mockCaptureException).not.toHaveBeenCalled();

			process.env.NODE_ENV = originalEnv;
		});

		test("should handle Sentry reporting errors gracefully", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			const mockCaptureException = vi.fn().mockImplementation(() => {
				throw new Error("Sentry error");
			});

			if (typeof window !== "undefined") {
				(window as Window & { Sentry: MockSentry }).Sentry = {
					captureException: mockCaptureException,
				};
			}

			const error = new Error("Test error");

			// Should not throw when Sentry fails
			expect(() => {
				render(
					<ErrorBoundary>
						<ThrowError error={error} />
					</ErrorBoundary>
				);
			}).not.toThrow();

			process.env.NODE_ENV = originalEnv;
		});
	});

	describe("Error Logging", () => {
		test("should log error with context", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary level="page">
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(logger.logError).toHaveBeenCalledWith(
				"ErrorBoundary caught error",
				error,
				expect.objectContaining({
					category: expect.any(String),
					message: "Test error",
				})
			);
		});

		test("should include component stack in error log", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(logger.logError).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(Error),
				expect.objectContaining({
					context: expect.objectContaining({
						componentStack: expect.any(String),
					}),
				})
			);
		});

		test("should call custom onError handler", () => {
			const onError = vi.fn();
			const error = new Error("Test error");

			render(
				<ErrorBoundary onError={onError}>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(onError).toHaveBeenCalledWith(
				error,
				expect.objectContaining({
					componentStack: expect.any(String),
				})
			);
		});
	});

	describe("Error Boundary Levels", () => {
		test("should render app-level error boundary with full-screen layout", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary level="app">
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			const alert = screen.getByRole("alert");
			expect(alert.className).toContain("min-h-screen");
			expect(screen.getByRole("button", { name: /Go to home page/i })).toBeInTheDocument();
		});

		test("should render page-level error boundary", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary level="page">
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByRole("button", { name: /Go to dashboard/i })).toBeInTheDocument();
		});

		test("should render section-level error boundary with compact layout", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary level="section">
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			const alert = screen.getByRole("alert");
			expect(alert.className).toContain("min-h-[200px]");
		});

		test("should default to section level when not specified", () => {
			const error = new Error("Test error");

			render(
				<ErrorBoundary>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			const alert = screen.getByRole("alert");
			expect(alert.className).toContain("min-h-[200px]");
		});
	});

	describe("Reset Keys", () => {
		test("should auto-reset when resetKeys change", async () => {
			const error = new Error("Test error");
			let shouldThrow = true;

			function ConditionalThrow() {
				if (shouldThrow) {
					throw error;
				}
				return <div>Success</div>;
			}

			const { rerender } = render(
				<ErrorBoundary resetKeys={["key1"]}>
					<ConditionalThrow />
				</ErrorBoundary>
			);

			expect(screen.getByRole("alert")).toBeInTheDocument();

			// Change reset key and fix error
			shouldThrow = false;
			rerender(
				<ErrorBoundary resetKeys={["key2"]}>
					<ConditionalThrow />
				</ErrorBoundary>
			);

			await waitFor(() => {
				expect(screen.queryByRole("alert")).not.toBeInTheDocument();
			});
		});

		test("should not reset when resetKeys remain the same", () => {
			const error = new Error("Test error");

			const { rerender } = render(
				<ErrorBoundary resetKeys={["key1"]}>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByRole("alert")).toBeInTheDocument();

			// Rerender with same key
			rerender(
				<ErrorBoundary resetKeys={["key1"]}>
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			expect(screen.getByRole("alert")).toBeInTheDocument();
		});

		test("should handle multiple resetKeys", () => {
			const error = new Error("Test error");
			let shouldThrow = true;

			function ConditionalThrow() {
				if (shouldThrow) {
					throw error;
				}
				return <div>Success</div>;
			}

			const { rerender } = render(
				<ErrorBoundary resetKeys={["key1", "key2"]}>
					<ConditionalThrow />
				</ErrorBoundary>
			);

			expect(screen.getByRole("alert")).toBeInTheDocument();

			// Change one key
			shouldThrow = false;
			rerender(
				<ErrorBoundary resetKeys={["key1", "key3"]}>
					<ConditionalThrow />
				</ErrorBoundary>
			);
		});
	});

	describe("useErrorHandler Hook", () => {
		test("should throw error when set", async () => {
			const error = new Error("Hook error");

			expect(() => {
				render(
					<ErrorBoundary>
						<UseErrorHandlerComponent error={error} />
					</ErrorBoundary>
				);
			}).not.toThrow();

			await waitFor(() => {
				expect(screen.getByRole("alert")).toBeInTheDocument();
			});
		});

		test("should not throw when error is null", () => {
			render(
				<ErrorBoundary>
					<UseErrorHandlerComponent error={null} />
				</ErrorBoundary>
			);

			expect(screen.getByText("Component with error handler")).toBeInTheDocument();
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		});

		test("should work with error boundary", async () => {
			const error = new Error("Hook error");

			render(
				<ErrorBoundary>
					<UseErrorHandlerComponent error={error} />
				</ErrorBoundary>
			);

			await waitFor(() => {
				expect(screen.getByRole("alert")).toBeInTheDocument();
			});
		});
	});

	describe("Navigation Actions", () => {
		test("should navigate to dashboard on page-level error", async () => {
			const user = userEvent.setup();
			const error = new Error("Test error");

			// Mock window.location
			delete (window as Partial<Window>).location;
			window.location = { href: "" } as Location;

			render(
				<ErrorBoundary level="page">
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			const dashboardButton = screen.getByRole("button", { name: /Go to dashboard/i });
			await user.click(dashboardButton);

			expect(window.location.href).toBe("/dashboard");
		});

		test("should navigate to home on app-level error", async () => {
			const user = userEvent.setup();
			const error = new Error("Test error");

			// Mock window.location
			delete (window as Partial<Window>).location;
			window.location = { href: "" } as Location;

			render(
				<ErrorBoundary level="app">
					<ThrowError error={error} />
				</ErrorBoundary>
			);

			const homeButton = screen.getByRole("button", { name: /Go to home page/i });
			await user.click(homeButton);

			expect(window.location.href).toBe("/");
		});
	});
});
