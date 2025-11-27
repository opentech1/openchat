"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "openchat_chat_read_times";
const INIT_TIME_KEY = "openchat_read_tracking_init";

type ChatReadTimes = Record<string, number>;

/**
 * Hook to track when chats were last read by the user.
 * Uses localStorage to persist read times across sessions.
 * 
 * Key behavior:
 * - Only shows "unread" for messages that arrived AFTER the tracking system was initialized
 * - This prevents all existing chats from showing as unread when the feature is first used
 * - Chats are marked as read when the user views them
 */
export function useChatReadStatus() {
  const [readTimes, setReadTimes] = useState<ChatReadTimes>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const initTimeRef = useRef<number>(0);

  // Load read times from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
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
    
    // Load stored read times
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setReadTimes(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  // Mark a chat as read (user viewed it)
  const markAsRead = useCallback((chatId: string) => {
    const now = Date.now();
    setReadTimes((prev) => {
      const next = { ...prev, [chatId]: now };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  // Check if a chat has unread messages
  // A chat is "unread" if:
  // 1. Not currently viewing it
  // 2. Has messages
  // 3. The last message was AFTER the tracking system was initialized
  // 4. The last message was AFTER the user last read the chat
  const isUnread = useCallback(
    (chatId: string, lastMessageAt: number | null | undefined, isActive: boolean) => {
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
