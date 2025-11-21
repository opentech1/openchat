"use client";

import { useState, useEffect } from "react";
import { LOCAL_STORAGE_KEYS } from "@/config/storage-keys";
import { getStorageItemSync, setStorageItemSync } from "@/lib/storage";

/**
 * Hook to manage Jon Mode setting (prevents AI from using em-dashes)
 *
 * @returns {Object} Jon Mode state and setter
 * @returns {boolean} jonMode - Whether Jon Mode is enabled
 * @returns {(enabled: boolean) => void} setJonMode - Function to update Jon Mode
 * @returns {boolean} isLoading - Whether the initial value is being loaded
 *
 * @example
 * ```tsx
 * const { jonMode, setJonMode, isLoading } = useJonMode();
 *
 * if (!isLoading) {
 *   <Toggle checked={jonMode} onCheckedChange={setJonMode} />
 * }
 * ```
 */
export function useJonMode() {
  const [jonMode, setJonModeState] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial value from localStorage
  useEffect(() => {
    const stored = getStorageItemSync(LOCAL_STORAGE_KEYS.USER.JON_MODE);
    if (stored !== null) {
      setJonModeState(stored === "true");
    }
    setIsLoading(false);
  }, []);

  // Update localStorage when value changes
  const setJonMode = (enabled: boolean) => {
    setJonModeState(enabled);
    setStorageItemSync(LOCAL_STORAGE_KEYS.USER.JON_MODE, enabled ? "true" : "false");
  };

  return { jonMode, setJonMode, isLoading };
}
