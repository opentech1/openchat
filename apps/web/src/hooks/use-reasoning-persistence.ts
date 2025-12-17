/**
 * useReasoningPersistence Hook
 *
 * Persists reasoning configuration to localStorage with cross-tab synchronization.
 * Uses useSyncExternalStore for reliable sync across browser tabs.
 *
 * Features:
 * - Reads from localStorage on mount
 * - Writes to localStorage when config changes
 * - Cross-tab sync via storage events
 * - JSON serialization/deserialization of ReasoningConfig
 *
 * @example
 * ```tsx
 * const { reasoningConfig, setReasoningConfig } = useReasoningPersistence();
 * ```
 */

import { useCallback, useSyncExternalStore } from "react";
import { LOCAL_STORAGE_KEYS } from "@/config/storage-keys";
import type { ReasoningConfig } from "@/lib/reasoning-config";
import { DEFAULT_REASONING_CONFIG } from "@/lib/reasoning-config";

// ============================================================================
// Storage key
// ============================================================================

const REASONING_CONFIG_KEY = LOCAL_STORAGE_KEYS.USER.REASONING_CONFIG;

// ============================================================================
// Cached snapshot for useSyncExternalStore
// ============================================================================

// Cache the snapshot to avoid infinite loops in useSyncExternalStore
// The snapshot must be referentially stable between calls
let cachedSnapshot: ReasoningConfig = DEFAULT_REASONING_CONFIG;

/**
 * Read from localStorage and update cached snapshot
 */
function readAndCacheStorage(): ReasoningConfig {
  if (typeof window === "undefined") return DEFAULT_REASONING_CONFIG;
  try {
    const stored = window.localStorage.getItem(REASONING_CONFIG_KEY);
    if (!stored) {
      cachedSnapshot = DEFAULT_REASONING_CONFIG;
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
      cachedSnapshot = parsed as ReasoningConfig;
      return cachedSnapshot;
    }

    cachedSnapshot = DEFAULT_REASONING_CONFIG;
    return cachedSnapshot;
  } catch {
    cachedSnapshot = DEFAULT_REASONING_CONFIG;
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
function getSnapshot(): ReasoningConfig {
  return cachedSnapshot;
}

/**
 * Server snapshot for useSyncExternalStore (always returns default)
 */
function getServerSnapshot(): ReasoningConfig {
  return DEFAULT_REASONING_CONFIG;
}

// ============================================================================
// localStorage operations
// ============================================================================

/**
 * Set reasoning config in localStorage and update cache
 */
function setReasoningConfigInStorage(config: ReasoningConfig | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (config === undefined) {
      window.localStorage.removeItem(REASONING_CONFIG_KEY);
      cachedSnapshot = DEFAULT_REASONING_CONFIG;
    } else {
      window.localStorage.setItem(REASONING_CONFIG_KEY, JSON.stringify(config));
      cachedSnapshot = config;
    }
    // Dispatch storage event for cross-tab sync and to trigger re-render
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: REASONING_CONFIG_KEY,
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
      if (e.key === REASONING_CONFIG_KEY || e.key === null) {
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
 * Return type for useReasoningPersistence hook
 */
export interface ReasoningPersistenceState {
  /** Current reasoning config (from localStorage or default) */
  reasoningConfig: ReasoningConfig | undefined;
  /** Set the reasoning config (persists to localStorage) */
  setReasoningConfig: (config: ReasoningConfig | undefined) => void;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for persisting reasoning configuration to localStorage.
 *
 * Uses useSyncExternalStore for cross-tab synchronization.
 * Returns undefined for reasoningConfig when disabled to match the expected
 * ChatComposer prop type (ReasoningConfig | undefined).
 */
export function useReasoningPersistence(): ReasoningPersistenceState {
  // Get reasoning config from localStorage using useSyncExternalStore
  const storedConfig = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /**
   * Set reasoning config with persistence
   */
  const setReasoningConfig = useCallback((config: ReasoningConfig | undefined) => {
    setReasoningConfigInStorage(config);
  }, []);

  // Return undefined when reasoning is disabled to match expected prop type
  const reasoningConfig = storedConfig.enabled ? storedConfig : undefined;

  return {
    reasoningConfig,
    setReasoningConfig,
  };
}

export default useReasoningPersistence;
