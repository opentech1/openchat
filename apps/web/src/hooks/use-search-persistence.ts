/**
 * useSearchPersistence Hook
 *
 * Persists web search configuration to localStorage with cross-tab synchronization.
 * Uses useSyncExternalStore for reliable sync across browser tabs.
 *
 * Features:
 * - Reads from localStorage on mount
 * - Writes to localStorage when config changes
 * - Cross-tab sync via storage events
 * - JSON serialization/deserialization of SearchConfig
 *
 * @example
 * ```tsx
 * const { searchConfig, setSearchConfig } = useSearchPersistence();
 * ```
 */

import { useCallback, useSyncExternalStore } from "react";
import { LOCAL_STORAGE_KEYS } from "@/config/storage-keys";
import type { SearchConfig } from "@/lib/search-config";
import { DEFAULT_SEARCH_CONFIG } from "@/lib/search-config";

// ============================================================================
// Storage key
// ============================================================================

const SEARCH_CONFIG_KEY = LOCAL_STORAGE_KEYS.USER.SEARCH_CONFIG;

// ============================================================================
// Cached snapshot for useSyncExternalStore
// ============================================================================

// Cache the snapshot to avoid infinite loops in useSyncExternalStore
// The snapshot must be referentially stable between calls
let cachedSnapshot: SearchConfig = DEFAULT_SEARCH_CONFIG;

/**
 * Read from localStorage and update cached snapshot
 */
function readAndCacheStorage(): SearchConfig {
  if (typeof window === "undefined") return DEFAULT_SEARCH_CONFIG;
  try {
    const stored = window.localStorage.getItem(SEARCH_CONFIG_KEY);
    if (!stored) {
      cachedSnapshot = DEFAULT_SEARCH_CONFIG;
      return cachedSnapshot;
    }

    const parsed = JSON.parse(stored) as unknown;

    // Validate the parsed object has the required structure
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "enabled" in parsed &&
      typeof (parsed as { enabled: unknown }).enabled === "boolean"
    ) {
      cachedSnapshot = parsed as SearchConfig;
      return cachedSnapshot;
    }

    cachedSnapshot = DEFAULT_SEARCH_CONFIG;
    return cachedSnapshot;
  } catch {
    cachedSnapshot = DEFAULT_SEARCH_CONFIG;
    return cachedSnapshot;
  }
}

// Initialize cache on module load (client-side only)
if (typeof window !== "undefined") {
  readAndCacheStorage();
}

/**
 * Get cached snapshot (returns stable reference)
 */
function getSnapshot(): SearchConfig {
  return cachedSnapshot;
}

/**
 * Server snapshot for useSyncExternalStore (always returns default)
 */
function getServerSnapshot(): SearchConfig {
  return DEFAULT_SEARCH_CONFIG;
}

// ============================================================================
// localStorage operations
// ============================================================================

/**
 * Set search config in localStorage and update cache
 */
function setSearchConfigInStorage(config: SearchConfig | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (config === undefined) {
      window.localStorage.removeItem(SEARCH_CONFIG_KEY);
      cachedSnapshot = DEFAULT_SEARCH_CONFIG;
    } else {
      window.localStorage.setItem(SEARCH_CONFIG_KEY, JSON.stringify(config));
      cachedSnapshot = config;
    }
    // Dispatch storage event for cross-tab sync and to trigger re-render
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SEARCH_CONFIG_KEY,
        newValue: config ? JSON.stringify(config) : null,
      })
    );
  } catch {
    // Ignore storage failures
  }
}

// ============================================================================
// useSyncExternalStore helpers
// ============================================================================

// List of subscribers to notify on storage changes
const subscribers = new Set<() => void>();

/**
 * Subscribe to localStorage changes (for useSyncExternalStore)
 */
function subscribe(callback: () => void): () => void {
  subscribers.add(callback);

  // Set up storage event listener only once
  if (subscribers.size === 1 && typeof window !== "undefined") {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SEARCH_CONFIG_KEY || e.key === null) {
        // Re-read and cache the value
        readAndCacheStorage();
        // Notify all subscribers
        subscribers.forEach((cb) => cb());
      }
    };
    window.addEventListener("storage", handleStorage);

    // Store the handler for cleanup
    (subscribe as { _handler?: typeof handleStorage })._handler = handleStorage;
  }

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && typeof window !== "undefined") {
      const handler = (subscribe as { _handler?: () => void })._handler;
      if (handler) {
        window.removeEventListener("storage", handler);
      }
    }
  };
}

// ============================================================================
// Types
// ============================================================================

/**
 * Return type for useSearchPersistence hook
 */
export interface SearchPersistenceState {
  /** Current search config (from localStorage or default) */
  searchConfig: SearchConfig;
  /** Set the search config (persists to localStorage) */
  setSearchConfig: (config: SearchConfig) => void;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for persisting web search configuration to localStorage.
 *
 * Uses useSyncExternalStore for cross-tab synchronization.
 */
export function useSearchPersistence(): SearchPersistenceState {
  // Get search config from localStorage using useSyncExternalStore
  const searchConfig = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /**
   * Set search config with persistence
   */
  const setSearchConfig = useCallback((config: SearchConfig) => {
    setSearchConfigInStorage(config);
  }, []);

  return {
    searchConfig,
    setSearchConfig,
  };
}

export default useSearchPersistence;
