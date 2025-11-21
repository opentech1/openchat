"use client";

import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import {
  categorizeError,
  formatErrorForLogging,
  getUserFriendlyErrorMessage,
  getErrorTitle,
  isRecoverableError,
  shouldReportError,
} from "@/lib/error-utils";
import { logError } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: ErrorBoundaryFallbackProps) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: Array<string | number>;
  level?: "app" | "page" | "section";
}

export interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
  level: "app" | "page" | "section";
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable Error Boundary component
 *
 * Features:
 * - Catches React errors in child components
 * - Shows user-friendly error UI
 * - Logs errors for error tracking
 * - Supports error recovery/retry
 * - Different UI for dev vs production
 * - TypeScript type safety
 * - Accessibility (ARIA labels)
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary level="page">
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError } = this.props;

    // Log error with context
    const errorLog = formatErrorForLogging(error, {
      componentStack: errorInfo.componentStack,
      level: this.props.level || "section",
    });

    logError("ErrorBoundary caught error", error, errorLog);

    // Report to error tracking service if appropriate
    if (shouldReportError(error)) {
      this.reportToErrorTracking(error, errorInfo);
    }

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Auto-reset when resetKeys change
    if (hasError && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== prevResetKeys[index]
      );

      if (hasResetKeyChanged) {
        this.resetError();
      }
    }
  }

  reportToErrorTracking = (error: Error, errorInfo: React.ErrorInfo) => {
    // In production, report to Sentry or other error tracking service
    if (process.env.NODE_ENV === "production") {
      // Sentry is automatically configured in Next.js
      // The global error handler will capture this
      // We can also manually capture with additional context:
      try {
        // Check if Sentry is available
        if (typeof window !== "undefined" && window.Sentry) {
          window.Sentry.captureException(error, {
            contexts: {
              react: {
                componentStack: errorInfo.componentStack,
              },
            },
          });
        }
      } catch (reportError) {
        // Silently fail if error reporting fails
        console.error("Failed to report error:", reportError);
      }
    }
  };

  resetError = () => {
    const { onReset } = this.props;

    this.setState({ hasError: false, error: null });

    // Call custom reset handler if provided
    if (onReset) {
      onReset();
    }
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback, level = "section" } = this.props;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (fallback && error) {
      return fallback({
        error,
        resetError: this.resetError,
        level,
      });
    }

    // Default fallback UI
    return (
      <DefaultErrorFallback
        error={error!}
        resetError={this.resetError}
        level={level}
      />
    );
  }
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback({
  error,
  resetError,
  level,
}: ErrorBoundaryFallbackProps) {
  const errorTitle = getErrorTitle(error);
  const errorMessage = getUserFriendlyErrorMessage(error);
  const isRecoverable = isRecoverableError(error);
  const isDev = process.env.NODE_ENV === "development";
  const categorized = categorizeError(error);

  // Different styles based on level
  const containerClasses = {
    app: "flex min-h-screen items-center justify-center p-6",
    page: "flex h-full min-h-[400px] items-center justify-center p-6",
    section: "flex min-h-[200px] items-center justify-center p-4",
  };

  const iconSize = {
    app: "size-12",
    page: "size-10",
    section: "size-8",
  };

  const titleSize = {
    app: "text-2xl",
    page: "text-xl",
    section: "text-lg",
  };

  return (
    <div
      className={containerClasses[level]}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Error Icon */}
        <div className="mx-auto flex items-center justify-center rounded-full bg-destructive/10 p-3">
          <AlertTriangle className={`${iconSize[level]} text-destructive`} aria-hidden="true" />
        </div>

        {/* Error Content */}
        <div className="space-y-2">
          <h2 className={`${titleSize[level]} font-semibold`}>
            {errorTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {errorMessage}
          </p>

          {/* Show error digest in production if available */}
          {!isDev && error && "digest" in error && typeof error.digest === "string" && (
            <p className="text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}

          {/* Show technical details in development */}
          {isDev && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Technical Details (Development Only)
              </summary>
              <div className="mt-2 rounded-md bg-muted p-3 text-xs">
                <div className="space-y-1">
                  <div>
                    <strong>Category:</strong> {categorized.category}
                  </div>
                  <div>
                    <strong>Message:</strong> {error.message}
                  </div>
                  {categorized.statusCode && (
                    <div>
                      <strong>Status Code:</strong> {categorized.statusCode}
                    </div>
                  )}
                  {error.stack && (
                    <div className="mt-2">
                      <strong>Stack Trace:</strong>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap text-[10px]">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </details>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {isRecoverable && (
            <Button
              onClick={resetError}
              className="gap-2"
              aria-label="Try again"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Try Again
            </Button>
          )}
          {level === "page" && (
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/dashboard";
                }
              }}
              className="gap-2"
              aria-label="Go to dashboard"
            >
              <Home className="size-4" aria-hidden="true" />
              Go to Dashboard
            </Button>
          )}
          {level === "app" && (
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              className="gap-2"
              aria-label="Go to home page"
            >
              <Home className="size-4" aria-hidden="true" />
              Go Home
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to use error boundary imperatively
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}
