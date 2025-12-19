"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { useConvexUser } from "@/contexts/convex-user-context";
import type { Id } from "@server/convex/_generated/dataModel";

const STORAGE_KEY = "openchat_chat_read_times";
const INIT_TIME_KEY = "openchat_read_tracking_init";

type ChatReadTimes = Record<string, number>;

/**
 * Hook to track when chats were last read by the user.
 *
 * Uses a hybrid approach:
 * - localStorage for immediate UI updates (optimistic)
 * - Convex DB for persistence across sessions/devices
 *
 * Key behavior:
 * - Only shows "unread" for messages that arrived AFTER the tracking system was initialized
 * - This prevents all existing chats from showing as unread when the feature is first used
 * - Chats are marked as read when the user views them
 * - Read times are synced to Convex in the background
 * - On page load, Convex data takes priority over localStorage
 *
 * SSR/Hydration safety:
 * - Returns stable empty values during SSR and initial hydration
 * - Only loads from localStorage after hydration is complete
 * - Uses useEffect to ensure localStorage access only happens client-side
 */
export function useChatReadStatus() {
  // Initialize with stable empty values for SSR
  const [readTimes, setReadTimes] = useState<ChatReadTimes>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const initTimeRef = useRef<number>(0);
  // Track if we've mounted to prevent hydration issues
  const hasMountedRef = useRef(false);
  // Track if we've synced from Convex to prevent multiple syncs
  const hasConvexSyncedRef = useRef(false);

  // Get Convex user for database operations
  const { convexUser, isLoading: isUserLoading } = useConvexUser();
  const userId = convexUser?._id;

  // Convex query for read statuses - only run when we have a user
  const convexReadStatuses = useQuery(
    api.chats.getChatReadStatuses,
    userId ? { userId } : "skip"
  );

  // Convex mutation to mark chat as read
  const markChatAsReadMutation = useMutation(api.chats.markChatAsRead);

  // Load read times from localStorage ONLY after mount (not during SSR/hydration)
  useEffect(() => {
    // Skip if already loaded or during SSR
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;

    // Use requestAnimationFrame to ensure we're past hydration
    // This prevents React error #418 (hydration mismatch)
    const rafId = requestAnimationFrame(() => {
      // Get or set the initialization time (when tracking first started)
      let initTime = 0;
      try {
        const storedInitTime = localStorage.getItem(INIT_TIME_KEY);
        if (storedInitTime) {
          initTime = Number.parseInt(storedInitTime, 10);
        } else {
          // First time using this feature - set init time to now
          // This means existing chats won't show as unread
          initTime = Date.now();
          localStorage.setItem(INIT_TIME_KEY, String(initTime));
        }
      } catch {
        initTime = Date.now();
      }
      initTimeRef.current = initTime;

      // Load stored read times from localStorage as initial values
      // These will be overwritten by Convex data once it loads
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setReadTimes(parsed);
        }
      } catch {
        // Ignore parse errors
      }
      setIsLoaded(true);
    });

    return () => cancelAnimationFrame(rafId);
  }, []);

  // Sync read times from Convex once data loads
  // This overwrites localStorage data with server data (source of truth)
  useEffect(() => {
    // Wait for both mount and Convex data
    if (!isLoaded || hasConvexSyncedRef.current) return;
    if (convexReadStatuses === undefined) return; // Still loading

    hasConvexSyncedRef.current = true;

    if (convexReadStatuses && convexReadStatuses.length > 0) {
      // Convert Convex data to our local format
      const convexTimes: ChatReadTimes = {};
      for (const status of convexReadStatuses) {
        convexTimes[status.chatId] = status.lastReadAt;
      }

      // Merge with localStorage - take the more recent timestamp for each chat
      setReadTimes((localTimes) => {
        const merged = { ...localTimes };
        for (const [chatId, convexTime] of Object.entries(convexTimes)) {
          const localTime = localTimes[chatId] ?? 0;
          // Use the more recent timestamp (in case localStorage has newer data from current session)
          merged[chatId] = Math.max(localTime, convexTime);
        }

        // Update localStorage with merged data
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // Ignore storage errors
        }

        return merged;
      });
    }
  }, [isLoaded, convexReadStatuses]);

  // Mark a chat as read (user viewed it)
  const markAsRead = useCallback((chatId: string) => {
    // Don't mark as read until we've loaded (prevents overwriting stored data)
    if (!hasMountedRef.current) return;

    const now = Date.now();

    // Optimistic update: Update localStorage and state immediately
    setReadTimes((prev) => {
      const next = { ...prev, [chatId]: now };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });

    // Background sync: Update Convex database
    if (userId) {
      // Fire and forget - don't await, don't block UI
      markChatAsReadMutation({
        userId,
        chatId: chatId as Id<"chats">,
      }).catch(() => {
        // Silently fail - localStorage still has the data
        // Will sync on next successful mutation
      });
    }
  }, [userId, markChatAsReadMutation]);

  // Check if a chat has unread messages
  // A chat is "unread" if:
  // 1. Not currently viewing it
  // 2. Has messages
  // 3. The last message was AFTER the tracking system was initialized
  // 4. The last message was AFTER the user last read the chat
  const isUnread = useCallback(
    (chatId: string, lastMessageAt: number | null | undefined, isActive: boolean) => {
      // CRITICAL: Return false during SSR and initial hydration to prevent React errors
      // This ensures server and client render the same initial state
      if (!isLoaded) return false;
      if (isActive) return false; // Currently viewing = always read
      if (!lastMessageAt) return false; // No messages = nothing to read

      // Don't show unread for messages that existed before tracking started
      // This prevents all existing chats from showing as unread
      if (lastMessageAt < initTimeRef.current) return false;

      const lastRead = readTimes[chatId];
      if (!lastRead) {
        // Never read this chat, but only show unread if message is after tracking init
        return lastMessageAt > initTimeRef.current;
      }

      // Show unread if there's a new message since last read
      return lastMessageAt > lastRead;
    },
    [readTimes, isLoaded]
  );

  return { markAsRead, isUnread, isLoaded };
}
