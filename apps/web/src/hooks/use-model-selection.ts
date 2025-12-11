/**
 * useModelSelection Hook
 *
 * Consolidates model loading, caching, and selection logic into a single hook.
 * Replaces scattered useEffects with a more declarative approach.
 *
 * Features:
 * - Fetches models from OpenRouter API (with caching)
 * - Persists selected model to localStorage
 * - Loads selected model from localStorage on mount
 * - Validates selected model exists in available list
 * - Uses useSyncExternalStore for localStorage sync
 *
 * Architecture Notes:
 * - useSyncExternalStore: Used for localStorage synchronization (selected model persistence)
 * - useEffect for API fetch: Used for external OpenRouter API calls. This is intentional and
 *   appropriate. The "no useEffect for data fetching" guideline applies to Convex reactive
 *   queries (which should use useQuery). External HTTP APIs like OpenRouter don't have a
 *   reactive alternative, making useEffect the correct pattern here.
 *
 * @example
 * ```tsx
 * const {
 *   models,
 *   selectedModel,
 *   selectedModelId,
 *   isLoading,
 *   error,
 *   setSelectedModelId,
 * } = useModelSelection({ apiKey, defaultModelId: 'anthropic/claude-3-haiku' });
 * ```
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ModelSelectorOption } from "@/components/model-selector";
import {
  readCachedModels,
  writeCachedModels,
  clearCachedModels,
} from "@/lib/openrouter-model-cache";
import { LOCAL_STORAGE_KEYS } from "@/config/storage-keys";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { captureClientEvent } from "@/lib/posthog";
import { logError } from "@/lib/logger";
import { OPENROUTER_CONFIG } from "@/config/constants";
import { isApiError } from "@/lib/error-handling";

// ============================================================================
// Types
// ============================================================================

/**
 * Full OpenRouter model type from API response
 * Extends ModelSelectorOption with additional metadata
 *
 * Note on id vs value:
 * - `value` (from ModelSelectorOption) is the canonical field used for selection and persistence
 * - `id` is an optional legacy field that may be present in some API responses
 * - Always use `value` for model identification and comparison
 */
export interface OpenRouterModel extends ModelSelectorOption {
  /** Optional legacy model ID field - prefer using `value` instead */
  id?: string;
}

/**
 * Options for the useModelSelection hook
 */
export interface UseModelSelectionOptions {
  /** OpenRouter API key - required to fetch models */
  apiKey?: string | null;
  /** Default model ID to use if no model is selected or stored */
  defaultModelId?: string;
  /** Callback when API key is invalid (401 response) */
  onInvalidApiKey?: () => void;
}

/**
 * Return type for useModelSelection hook
 */
export interface ModelSelectionState {
  /** Available models from OpenRouter (null = not yet loaded, [] = loaded but empty) */
  models: OpenRouterModel[] | null;
  /** Currently selected model object (null if not found in models list) */
  selectedModel: OpenRouterModel | null;
  /** Currently selected model ID */
  selectedModelId: string | null;
  /** True while fetching models from API */
  isLoading: boolean;
  /** Error from model fetching */
  error: Error | null;
  /** Set the selected model ID (persists to localStorage) */
  setSelectedModelId: (id: string) => void;
  /** Refresh models from API (bypasses cache) */
  refreshModels: () => Promise<void>;
}

// ============================================================================
// localStorage sync using useSyncExternalStore
// Note: useSyncExternalStore is used ONLY for localStorage synchronization
// (selected model persistence), NOT for data fetching. External API fetching
// still uses useEffect, which is appropriate for non-Convex data sources.
// ============================================================================

const SELECTED_MODEL_KEY = LOCAL_STORAGE_KEYS.USER.LAST_MODEL;

/**
 * Get selected model ID from localStorage (synchronous)
 */
function getSelectedModelIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SELECTED_MODEL_KEY);
  } catch {
    return null;
  }
}

/**
 * Set selected model ID in localStorage
 */
function setSelectedModelIdInStorage(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      window.localStorage.setItem(SELECTED_MODEL_KEY, id);
    } else {
      window.localStorage.removeItem(SELECTED_MODEL_KEY);
    }
    // Dispatch storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent("storage", {
      key: SELECTED_MODEL_KEY,
      newValue: id,
    }));
  } catch {
    // Ignore storage failures
  }
}

/**
 * Subscribe to localStorage changes (for useSyncExternalStore)
 */
function subscribeToStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key === SELECTED_MODEL_KEY || e.key === null) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

/**
 * Server snapshot for useSyncExternalStore (always returns null)
 */
function getServerSnapshot(): string | null {
  return null;
}

// ============================================================================
// Model fetching state machine
// ============================================================================

type FetchState = {
  models: OpenRouterModel[] | null;
  isLoading: boolean;
  error: Error | null;
};

const INITIAL_FETCH_STATE: FetchState = {
  models: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for managing OpenRouter model selection with caching and persistence.
 *
 * Uses useSyncExternalStore for localStorage sync to avoid hydration mismatches.
 * Follows the T3Chat pattern: undefined/null = loading, [] = loaded but empty.
 */
export function useModelSelection(
  options: UseModelSelectionOptions = {}
): ModelSelectionState {
  const { apiKey, defaultModelId, onInvalidApiKey } = options;

  // Track abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track if we've initialized from cache (prevents double-reads)
  const cacheInitializedRef = useRef(false);

  // Fetch state using useState for proper React updates
  // IMPORTANT: Always initialize to INITIAL_FETCH_STATE for hydration safety.
  // Server renders null models, client hydrates with null, then useEffect loads cache.
  const [fetchState, setFetchState] = useState<FetchState>(INITIAL_FETCH_STATE);

  // Load cached models on mount (client-only) to avoid hydration mismatch
  // This runs once after hydration, ensuring server/client initial render match
  useEffect(() => {
    if (cacheInitializedRef.current) return;
    cacheInitializedRef.current = true;

    const cached = readCachedModels();
    if (cached && cached.length > 0) {
      setFetchState({
        models: cached,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  // Selected model ID from localStorage using useSyncExternalStore
  const storedSelectedModelId = useSyncExternalStore(
    subscribeToStorage,
    getSelectedModelIdFromStorage,
    getServerSnapshot
  );

  // Stable reference to current fetch state
  const { models, isLoading, error } = fetchState;

  // Use ref for onInvalidApiKey to keep fetchModels stable
  // This prevents unnecessary re-creates when the callback prop changes
  const onInvalidApiKeyRef = useRef(onInvalidApiKey);
  useLayoutEffect(() => {
    onInvalidApiKeyRef.current = onInvalidApiKey;
  });

  /**
   * Fetch models from OpenRouter API
   * @param key - The API key to use
   * @param force - If true, bypass cache and always fetch fresh data
   */
  const fetchModels = useCallback(
    async (key: string, force = false) => {
      // Skip if no key
      if (!key) return;

      // Check cache first (unless force refresh requested)
      if (!force) {
        const cached = readCachedModels();
        if (cached && cached.length > 0) {
          setFetchState({
            models: cached,
            isLoading: false,
            error: null,
          });
          return;
        }
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Update state to loading
      setFetchState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const response = await fetchWithCsrf("/api/openrouter/models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
          signal: abortController.signal,
        });

        const data = await response.json();

        if (!response.ok || !data?.ok) {
          // Handle invalid API key
          if (response.status === 401) {
            onInvalidApiKeyRef.current?.();
            clearCachedModels();
            setFetchState({
              models: [],
              isLoading: false,
              error: new Error("Invalid API key"),
            });
            return;
          }

          const errorMessage =
            typeof data?.message === "string" && data.message.length > 0
              ? data.message
              : "Failed to fetch OpenRouter models.";

          // Track error in analytics
          let providerHost: string = OPENROUTER_CONFIG.HOST;
          try {
            const baseUrl =
              process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL ??
              "https://openrouter.ai/api/v1";
            providerHost = new URL(response.url ?? baseUrl).host;
          } catch {
            providerHost = OPENROUTER_CONFIG.HOST;
          }

          captureClientEvent("openrouter.models_fetch_failed", {
            status: response.status,
            error_message: errorMessage,
            provider_host: providerHost,
            has_api_key: Boolean(key),
          });

          throw new Error(errorMessage);
        }

        // Runtime validation of API response
        if (!Array.isArray(data.models)) {
          throw new Error("Invalid API response: models is not an array");
        }

        const parsedModels = data.models as OpenRouterModel[];

        // Update cache
        writeCachedModels(parsedModels);

        // Update state (only if not aborted)
        if (!abortController.signal.aborted) {
          setFetchState({
            models: parsedModels,
            isLoading: false,
            error: null,
          });
        }
      } catch (err: unknown) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        logError("Failed to load OpenRouter models", err);

        // Track error in analytics if not already tracked
        if (isApiError(err) && !err.__posthogTracked) {
          const status = typeof err.status === "number" ? err.status : 0;
          let providerHost: string = OPENROUTER_CONFIG.HOST;
          const providerUrl = err.providerUrl;
          if (typeof providerUrl === "string" && providerUrl.length > 0) {
            try {
              providerHost = new URL(providerUrl).host;
            } catch {
              providerHost = OPENROUTER_CONFIG.HOST;
            }
          }
          captureClientEvent("openrouter.models_fetch_failed", {
            status,
            error_message: err instanceof Error ? err.message : "Failed to load models",
            provider_host: providerHost,
            has_api_key: Boolean(key),
          });
        }

        if (!abortController.signal.aborted) {
          setFetchState((prev) => ({
            models: prev.models, // Keep existing models on error
            isLoading: false,
            error: err instanceof Error ? err : new Error("Failed to load models"),
          }));
        }
      } finally {
        // Clear abort controller if this is still the active request
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [] // Now stable - no dependencies since we use refs for callbacks
  );

  // Cleanup: abort pending requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Fetch models when API key becomes available or changes
  // Note: This useEffect is appropriate for external API calls (OpenRouter).
  // The "no useEffect for data fetching" guideline applies to Convex reactive queries.
  const lastFetchedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!apiKey) {
      lastFetchedKeyRef.current = null;
      return;
    }

    // Skip if we already fetched for this key
    if (apiKey === lastFetchedKeyRef.current) {
      return;
    }

    lastFetchedKeyRef.current = apiKey;
    // fetchModels handles cache internally - will return early if valid cache exists
    void fetchModels(apiKey);
  }, [apiKey, fetchModels]);

  /**
   * Set selected model ID with persistence
   */
  const setSelectedModelId = useCallback((id: string) => {
    setSelectedModelIdInStorage(id);
  }, []);

  /**
   * Refresh models from API (bypasses cache)
   */
  const refreshModels = useCallback(async () => {
    if (!apiKey) return;
    await fetchModels(apiKey, true);
  }, [apiKey, fetchModels]);

  // Compute the effective selected model ID
  const effectiveSelectedModelId = useMemo(() => {
    // Priority: stored > default > first model
    if (storedSelectedModelId && models?.some((m) => m.value === storedSelectedModelId)) {
      return storedSelectedModelId;
    }
    if (defaultModelId && models?.some((m) => m.value === defaultModelId)) {
      return defaultModelId;
    }
    return models?.[0]?.value ?? null;
  }, [storedSelectedModelId, defaultModelId, models]);

  // Find the selected model object
  const selectedModel = useMemo(() => {
    if (!effectiveSelectedModelId || !models) return null;
    return models.find((m) => m.value === effectiveSelectedModelId) ?? null;
  }, [effectiveSelectedModelId, models]);

  return {
    models,
    selectedModel,
    selectedModelId: effectiveSelectedModelId,
    isLoading,
    error,
    setSelectedModelId,
    refreshModels,
  };
}

export default useModelSelection;
