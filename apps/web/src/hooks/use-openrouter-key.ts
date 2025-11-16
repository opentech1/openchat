/**
 * Hook for managing OpenRouter API key with server-side encrypted storage
 * Keys are encrypted in browser, stored in database, and synced across devices
 *
 * IMPORTANT: Only use this hook in client-only components (with ssr: false)
 * or within components that are dynamically imported with { ssr: false }
 *
 * NOTE: This hook loads the decrypted key for internal use (API calls).
 * Never display the decrypted key in the UI - use hasKey for UI display.
 */

import { useEffect, useState, useCallback } from "react";
import { useConvex } from "convex/react";
import { authClient } from "@/lib/auth-client";
import {
  saveOpenRouterKey,
  loadOpenRouterKey,
  removeOpenRouterKey,
} from "@/lib/openrouter-key-storage";
import { logError } from "@/lib/logger";
import { useConvexUser } from "@/contexts/convex-user-context";

export function useOpenRouterKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const convex = useConvex();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  // Check if Convex client is available before calling hooks
  const isConvexReady = convex !== null && convex !== undefined;

  // Get Convex user from shared context
  const { convexUser } = useConvexUser();

  // Load API key on mount or when user changes
  useEffect(() => {
    // Don't try to load if Convex is not ready yet
    if (!isConvexReady) {
      setIsLoading(false);
      return;
    }

    if (!user?.id || !convexUser?._id) {
      setApiKey(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const key = await loadOpenRouterKey(convexUser._id, user.id, convex);
        if (!cancelled) {
          setApiKey(key);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          logError("Failed to load OpenRouter key", error);
          setError(error);
          setApiKey(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConvexReady, user?.id, convexUser?._id, convex]);

  const saveKey = useCallback(
    async (newKey: string) => {
      if (!isConvexReady || !convex) {
        throw new Error("Convex client not ready");
      }
      if (!user?.id || !convexUser?._id) {
        throw new Error("User not authenticated");
      }

      try {
        await saveOpenRouterKey(newKey, convexUser._id, user.id, convex);
        setApiKey(newKey);
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logError("Failed to save OpenRouter key", error);
        setError(error);
        throw error;
      }
    },
    [isConvexReady, convex, user?.id, convexUser?._id]
  );

  const removeKey = useCallback(async () => {
    if (!isConvexReady || !convex) {
      throw new Error("Convex client not ready");
    }
    if (!convexUser?._id) {
      throw new Error("User not authenticated");
    }

    try {
      await removeOpenRouterKey(convexUser._id, convex);
      setApiKey(null);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError("Failed to remove OpenRouter key", error);
      setError(error);
      throw error;
    }
  }, [isConvexReady, convex, convexUser?._id]);

  return {
    apiKey,
    isLoading,
    error,
    hasKey: apiKey !== null,
    saveKey,
    removeKey,
  };
}
