"use client";

import React, { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw, Home, MessageSquare } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  categorizeError,
  formatErrorForLogging,
  getUserFriendlyErrorMessage,
  getErrorTitle,
  isRecoverableError,
  shouldReportError,
  getErrorCategory,
} from "@/lib/error-utils";
import { logError } from "@/lib/logger";

interface ChatErrorBoundaryProps {
  children: ReactNode;
  chatId?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
  fallbackRender?: (props: ChatErrorFallbackProps) => ReactNode;
}

export interface ChatErrorFallbackProps {
  error: Error;
  resetError: () => void;
  chatId?: string;
}

interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Specialized Error Boundary for Chat Interface
 *
 * Features:
 * - Specialized error handling for chat scenarios
 * - Preserves chat state when possible
 * - Shows inline error messages
 * - Provides chat-specific recovery options
 * - Handles streaming errors gracefully
 *
 * Usage:
 * ```tsx
 * <ChatErrorBoundary chatId={chatId}>
 *   <ChatRoom />
 * </ChatErrorBoundary>
 * ```
 */
export class ChatErrorBoundary extends Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError, chatId } = this.props;

    // Log error with chat context
    const errorLog = formatErrorForLogging(error, {
      componentStack: errorInfo.componentStack,
      chatId,
      context: "chat",
    });

    logError("ChatErrorBoundary caught error", error, errorLog);

    // Report to error tracking service if appropriate
    if (shouldReportError(error)) {
      this.reportToErrorTracking(error, errorInfo);
    }

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
  }

  reportToErrorTracking = (error: Error, errorInfo: React.ErrorInfo) => {
    if (process.env.NODE_ENV === "production") {
      try {
        if (typeof window !== "undefined" && (window as any).Sentry) {
          const Sentry = (window as any).Sentry;
          Sentry.captureException(error, {
            contexts: {
              react: {
                componentStack: errorInfo.componentStack,
              },
              chat: {
                chatId: this.props.chatId,
              },
            },
            tags: {
              errorBoundary: "chat",
            },
          });
        }
      } catch (reportError) {
        console.error("Failed to report error:", reportError);
      }
    }
  };

  resetError = () => {
    const { onReset } = this.props;

    this.setState({ hasError: false, error: null });

    if (onReset) {
      onReset();
    }
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallbackRender, chatId } = this.props;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (fallbackRender && error) {
      return fallbackRender({
        error,
        resetError: this.resetError,
        chatId,
      });
    }

    // Default chat-specific fallback UI
    return (
      <ChatErrorFallback
        error={error!}
        resetError={this.resetError}
        chatId={chatId}
      />
    );
  }
}

/**
 * Chat-specific error fallback component
 */
function ChatErrorFallback({ error, resetError, chatId }: ChatErrorFallbackProps) {
  const errorTitle = getErrorTitle(error);
  const errorMessage = getUserFriendlyErrorMessage(error);
  const isRecoverable = isRecoverableError(error);
  const isDev = process.env.NODE_ENV === "development";
  const category = getErrorCategory(error);
  const categorized = categorizeError(error);

  // Determine if this is a chat-specific error
  const isChatLoadError = category === "not_found" || category === "authorization";
  const isStreamingError = error.message.toLowerCase().includes("stream");

  return (
    <div
      className="flex h-full min-h-[400px] items-center justify-center p-6"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="w-full max-w-lg space-y-6">
        {/* Error Card */}
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 shadow-sm">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-5 text-destructive" aria-hidden="true" />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                {errorTitle}
              </h2>
              <p className="text-sm text-muted-foreground">
                {errorMessage}
              </p>

              {/* Error-specific help text */}
              {isChatLoadError && (
                <p className="mt-2 text-sm text-muted-foreground">
                  This chat may have been deleted or you may not have access to it.
                </p>
              )}
              {isStreamingError && (
                <p className="mt-2 text-sm text-muted-foreground">
                  The AI response was interrupted. Your messages have been saved.
                </p>
              )}

              {/* Show error digest in production */}
              {!isDev && error && typeof (error as any).digest === "string" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Error ID: {(error as any).digest}
                </p>
              )}

              {/* Development details - compact and contained */}
              {isDev && (
                <details className="mt-3 max-w-full">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Technical Details (Development Only)
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-md bg-background/50 p-2 text-xs">
                    <div className="space-y-1 font-mono text-[10px]">
                      <p><strong>Category:</strong> {categorized.category}</p>
                      <p className="break-all"><strong>Message:</strong> {error.message.slice(0, 200)}{error.message.length > 200 ? "..." : ""}</p>
                      {categorized.statusCode && (
                        <p><strong>Status:</strong> {categorized.statusCode}</p>
                      )}
                      {chatId && (
                        <p className="break-all"><strong>Chat ID:</strong> {chatId}</p>
                      )}
                      {error.stack && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Stack trace
                          </summary>
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[9px] leading-tight">
                            {error.stack.slice(0, 1500)}{error.stack.length > 1500 ? "\n..." : ""}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </details>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-2">
            {isRecoverable && !isChatLoadError && (
              <Button
                onClick={resetError}
                size="sm"
                className="gap-2"
                aria-label="Retry loading chat"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Try Again
              </Button>
            )}
            <ChatErrorActions
              chatId={chatId}
              isChatLoadError={isChatLoadError}
            />
          </div>
        </div>

        {/* Help Text */}
        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {isRecoverable
              ? "If the problem persists, try refreshing the page or starting a new chat."
              : "You can return to the dashboard to access your other chats."}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Chat error action buttons (client component with router)
 */
function ChatErrorActions({
  chatId,
  isChatLoadError,
}: {
  chatId?: string;
  isChatLoadError: boolean;
}) {
  const router = useRouter();

  const handleNewChat = () => {
    router.push("/dashboard");
  };

  const handleDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <>
      {!isChatLoadError && (
        <Button
          onClick={handleNewChat}
          size="sm"
          variant="outline"
          className="gap-2"
          aria-label="Start new chat"
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          New Chat
        </Button>
      )}
      <Button
        onClick={handleDashboard}
        size="sm"
        variant="outline"
        className="gap-2"
        aria-label="Go to dashboard"
      >
        <Home className="size-4" aria-hidden="true" />
        Dashboard
      </Button>
    </>
  );
}

/**
 * Hook to wrap async chat operations with error handling
 */
export function useChatErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const handleError = React.useCallback((err: unknown) => {
    if (err instanceof Error) {
      setError(err);
    } else {
      setError(new Error(String(err)));
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { handleError, clearError, hasError: error !== null };
}

/**
 * Inline error display for chat messages
 */
export function ChatInlineError({
  error,
  onRetry,
  onDismiss,
}: {
  error: Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const errorMessage =
    typeof error === "string" ? error : getUserFriendlyErrorMessage(error);

  return (
    <div
      className="rounded-lg border border-destructive/20 bg-destructive/5 p-3"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="size-4 flex-shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex-1 space-y-2">
          <p className="text-sm text-foreground">{errorMessage}</p>
          <div className="flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs font-medium text-destructive hover:underline"
                aria-label="Retry"
              >
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs font-medium text-muted-foreground hover:underline"
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
