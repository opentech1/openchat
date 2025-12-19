import { useEffect } from "react";

const INVALIDATE_CHATS_CACHE_EVENT = "invalidate-chats-cache";

/**
 * Dispatches a custom event to invalidate the chats cache across all components.
 * This enables cross-component data synchronization without prop drilling.
 */
export function invalidateChatsCache(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INVALIDATE_CHATS_CACHE_EVENT));
  }
}

/**
 * Hook that listens for chats cache invalidation events and triggers a refetch.
 * Use this in components that display chat data to keep them synchronized.
 *
 * @param refetch - Function to call when the cache should be invalidated
 */
export function useChatsInvalidation(refetch: () => void): void {
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener(INVALIDATE_CHATS_CACHE_EVENT, handler);
    return () => window.removeEventListener(INVALIDATE_CHATS_CACHE_EVENT, handler);
  }, [refetch]);
}
