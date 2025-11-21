"use client";

import { AlertTriangle, RefreshCw, Home } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import {
  categorizeError,
  getUserFriendlyErrorMessage,
  getErrorTitle,
  isRecoverableError,
} from "@/lib/error-utils";

export interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset?: () => void;
  onHomeClick?: () => void;
  showHomeButton?: boolean;
  title?: string;
  message?: string;
}

/**
 * Shared Error Fallback Component
 *
 * Consolidates the error UI used across multiple error boundaries
 * Provides consistent error presentation with optional recovery actions
 */
export function ErrorFallback({
  error,
  reset,
  onHomeClick,
  showHomeButton = true,
  title,
  message,
}: ErrorFallbackProps) {
  const errorTitle = title || getErrorTitle(error);
  const errorMessage = message || getUserFriendlyErrorMessage(error);
  const isRecoverable = isRecoverableError(error);
  const categorized = categorizeError(error);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold">{errorTitle}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {errorMessage}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
        )}
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
      <div className="flex gap-2">
        {isRecoverable && reset && (
          <Button onClick={reset} className="gap-2" aria-label="Try again">
            <RefreshCw className="size-4" aria-hidden="true" />
            Try Again
          </Button>
        )}
        {showHomeButton && onHomeClick && (
          <Button
            variant="outline"
            onClick={onHomeClick}
            className="gap-2"
            aria-label="Return to dashboard"
          >
            <Home className="size-4" aria-hidden="true" />
            Return to Dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
