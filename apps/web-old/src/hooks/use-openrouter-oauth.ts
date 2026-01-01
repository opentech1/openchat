/**
 * Hook for OpenRouter OAuth PKCE authentication flow
 *
 * Provides a simple interface for initiating OpenRouter OAuth login
 * with built-in loading and error states.
 *
 * Usage:
 * ```tsx
 * const { initiateLogin, isLoading, error } = useOpenRouterOAuth();
 *
 * <button onClick={initiateLogin} disabled={isLoading}>
 *   {isLoading ? 'Connecting...' : 'Connect OpenRouter'}
 * </button>
 * ```
 */

import { useState, useCallback } from "react";
import { initiateOAuthFlow } from "@/lib/openrouter-oauth";
import { logError } from "@/lib/logger";

interface UseOpenRouterOAuthReturn {
  /**
   * Initiates the OpenRouter OAuth flow
   * Redirects user to OpenRouter authorization page
   */
  initiateLogin: () => void;

  /**
   * Whether the OAuth flow is currently being initiated
   */
  isLoading: boolean;

  /**
   * Error that occurred during OAuth initiation
   */
  error: Error | null;
}

export function useOpenRouterOAuth(): UseOpenRouterOAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initiateLogin = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      // Get callback URL from environment or construct from current origin
      const callbackUrl =
        process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/openrouter/callback`
          : `${window.location.origin}/openrouter/callback`;

      // Initiate OAuth flow (will redirect user)
      initiateOAuthFlow(callbackUrl);

      // Note: isLoading will remain true until redirect happens
      // This is intentional to prevent UI flashing
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError("Failed to initiate OpenRouter OAuth", error);
      setError(error);
      setIsLoading(false);
    }
  }, []);

  return {
    initiateLogin,
    isLoading,
    error,
  };
}
