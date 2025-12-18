'use client';

import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ChatSDKError,
  type ErrorAction,
  type ErrorType,
} from '@/lib/errors/chat-sdk-error';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  WifiOff,
  Lock,
  RefreshCw,
  LogIn,
  ArrowUpCircle,
} from '@/lib/icons';

interface EnhancedErrorDisplayProps {
  /** The error to display */
  error: Error;
  /** Callback when user clicks retry */
  onRetry?: () => void;
  /** Callback when user clicks sign in */
  onSignIn?: () => void;
  /** Callback when user clicks upgrade */
  onUpgrade?: () => void;
  /** Callback when user clicks dismiss */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Color schemes based on error type for visual distinction
 */
const colorSchemes = {
  unauthorized: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500',
    text: 'text-amber-800 dark:text-amber-200',
  },
  rate_limit: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    icon: 'text-orange-500',
    text: 'text-orange-800 dark:text-orange-200',
  },
  upgrade_required: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    icon: 'text-purple-500',
    text: 'text-purple-800 dark:text-purple-200',
  },
  offline: {
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    border: 'border-gray-200 dark:border-gray-800',
    icon: 'text-gray-500',
    text: 'text-gray-800 dark:text-gray-200',
  },
  forbidden: {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800',
    icon: 'text-rose-500',
    text: 'text-rose-800 dark:text-rose-200',
  },
  bad_request: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    text: 'text-red-800 dark:text-red-200',
  },
  default: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    text: 'text-red-800 dark:text-red-200',
  },
} as const;

type ColorSchemeKey = keyof typeof colorSchemes;

/**
 * Get the appropriate icon component based on error type
 */
function getErrorIcon(errorType?: string) {
  switch (errorType) {
    case 'unauthorized':
      return LogIn;
    case 'offline':
      return WifiOff;
    case 'forbidden':
      return Lock;
    case 'upgrade_required':
      return ArrowUpCircle;
    case 'rate_limit':
      return RefreshCw;
    default:
      return AlertCircle;
  }
}

/**
 * Parse error to extract structured information
 */
function parseError(error: Error): {
  errorType: string;
  errorMessage: string;
  errorCause?: string;
  actions: ErrorAction[];
} {
  // Check if it's already a ChatSDKError instance
  if (ChatSDKError.isChatSDKError(error)) {
    return {
      errorType: error.type,
      errorMessage: error.message,
      errorCause: error.errorCause,
      actions: error.getActions(),
    };
  }

  // Try to parse JSON from error message (for errors from API responses)
  try {
    const parsed = JSON.parse(error.message);
    if (parsed.code && typeof parsed.code === 'string' && parsed.message) {
      const errorType = parsed.code.split(':')[0] as ErrorType;
      // Create a ChatSDKError to get actions
      const sdkError = new ChatSDKError(parsed.code, parsed.cause);
      return {
        errorType,
        errorMessage: parsed.message,
        errorCause: parsed.cause,
        actions: sdkError.getActions(),
      };
    }
  } catch {
    // Not JSON, use raw error message
  }

  // Default: return basic error info
  return {
    errorType: 'default',
    errorMessage: error.message || 'An unexpected error occurred',
    errorCause: undefined,
    actions: [
      { label: 'Try Again', action: 'retry', primary: true },
      { label: 'Dismiss', action: 'dismiss' },
    ],
  };
}

/**
 * EnhancedErrorDisplay - A beautiful, actionable error display component
 *
 * Features:
 * - Contextual error messages based on error type
 * - Appropriate icons for each error type
 * - Action buttons (Sign In, Upgrade, Retry, etc.)
 * - Color schemes based on error severity
 * - Parses error JSON to extract structured error info
 *
 * @example
 * ```tsx
 * <EnhancedErrorDisplay
 *   error={error}
 *   onRetry={() => refetch()}
 *   onSignIn={() => router.push('/auth/sign-in')}
 *   onUpgrade={() => router.push('/pricing')}
 * />
 * ```
 */
export function EnhancedErrorDisplay({
  error,
  onRetry,
  onSignIn,
  onUpgrade,
  onDismiss,
  className,
}: EnhancedErrorDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { errorType, errorMessage, errorCause, actions } = parseError(error);

  const colorSchemeKey = (
    errorType in colorSchemes ? errorType : 'default'
  ) as ColorSchemeKey;
  const colors = colorSchemes[colorSchemeKey];
  const Icon = getErrorIcon(errorType);

  // Focus management: focus the container when error appears
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      containerRef.current?.focus();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [error]);

  // Handle Escape key to dismiss
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && onDismiss) {
        event.preventDefault();
        onDismiss();
      }
    },
    [onDismiss]
  );

  const handleAction = (action: ErrorAction) => {
    switch (action.action) {
      case 'sign_in':
        onSignIn?.();
        break;
      case 'upgrade':
        onUpgrade?.();
        break;
      case 'retry':
        onRetry?.();
        break;
      case 'dismiss':
        onDismiss?.();
        break;
      case 'check_connection':
        // Trigger a retry which will check connection
        onRetry?.();
        break;
      case 'contact_support':
        // Could open support modal or navigate to support page
        window.open('mailto:support@openchat.dev', '_blank');
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'rounded-lg border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        colors.bg,
        colors.border,
        className
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn('size-5 mt-0.5 flex-shrink-0', colors.icon)}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium', colors.text)}>{errorMessage}</p>
          {errorCause && (
            <p className={cn('mt-1 text-sm opacity-80', colors.text)}>
              {errorCause}
            </p>
          )}
          {actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action, idx) => (
                <Button
                  key={`${action.action}-${idx}`}
                  size="sm"
                  variant={action.primary ? 'default' : 'outline'}
                  onClick={() => handleAction(action)}
                  aria-label={action.label}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact variant of EnhancedErrorDisplay for inline use
 */
export function CompactErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className,
}: Pick<
  EnhancedErrorDisplayProps,
  'error' | 'onRetry' | 'onDismiss' | 'className'
>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { errorType, errorMessage } = parseError(error);

  const colorSchemeKey = (
    errorType in colorSchemes ? errorType : 'default'
  ) as ColorSchemeKey;
  const colors = colorSchemes[colorSchemeKey];
  const Icon = getErrorIcon(errorType);

  // Focus management: focus the container when error appears
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      containerRef.current?.focus();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [error]);

  // Handle Escape key to dismiss
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && onDismiss) {
        event.preventDefault();
        onDismiss();
      }
    },
    [onDismiss]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        colors.bg,
        colors.border,
        className
      )}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn('size-4 flex-shrink-0', colors.icon)}
          aria-hidden="true"
        />
        <span className={cn('flex-1 truncate', colors.text)}>
          {errorMessage}
        </span>
        <div className="flex items-center gap-1">
          {onRetry && (
            <button
              onClick={onRetry}
              className={cn(
                'text-xs font-medium hover:underline',
                colors.text
              )}
              aria-label="Retry"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-xs font-medium text-muted-foreground hover:underline ml-2"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
