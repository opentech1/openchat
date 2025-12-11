/**
 * usePersistentChat - Hook for managing persistent chat streaming with Convex
 *
 * This hook provides:
 * 1. Stream reconnection logic (detect and reconnect to active streams on page reload)
 * 2. Stream state management (idle, active, reconnecting)
 * 3. Real-time stream content via reactive Convex queries
 * 4. Chat preparation and message sending
 *
 * Key design decisions:
 * - Uses reactive Convex queries for stream body (no polling/effects for data fetching)
 * - Tracks "driven" streams (ones created in THIS browser session) for optimistic UI
 * - Only uses useEffect for TRUE side effects (initial prop sync, stream completion handling)
 * - Works alongside useChatSession hook and AI SDK's useChat
 *
 * Stream states:
 * - 'idle': No active stream
 * - 'active': Stream is running (either newly created or reconnected)
 * - 'reconnecting': Detected a stream in DB, waiting to reconnect
 *
 * @example
 * ```tsx
 * const {
 *   streamState,
 *   activeStreamId,
 *   streamBody,
 *   needsReconnect,
 *   startStream,
 *   clearStream,
 *   isStreamDriven,
 * } = usePersistentChat({
 *   chatId,
 *   userId,
 *   initialStreamId,
 *   onStreamComplete: () => { ... },
 *   onStreamError: (error) => { ... },
 * });
 * ```
 */

import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import type { Id } from "@server/convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

/**
 * Stream states for the UI
 * - idle: No active stream
 * - active: Stream is running
 * - reconnecting: Detected stream in DB, waiting to sync
 */
export type StreamState = "idle" | "active" | "reconnecting";

/**
 * Stream status from Convex (matches persistent-text-streaming)
 */
export type StreamStatus = "pending" | "streaming" | "done" | "error" | "timeout";

/**
 * Options for the usePersistentChat hook
 */
export interface UsePersistentChatOptions {
  /** The Convex chat ID */
  chatId: Id<"chats">;
  /** The authenticated user's Convex ID */
  userId: Id<"users">;
  /** Initial stream ID (from parent component, e.g., from message list) */
  initialStreamId?: string | null;
  /** Callback when stream completes successfully */
  onStreamComplete?: () => void;
  /** Callback when stream errors */
  onStreamError?: (error: Error) => void;
}

/**
 * Message format for conversation history sent to LLM
 */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Options for starting a new stream
 */
export interface StartStreamOptions {
  /** User's message content */
  userContent: string;
  /** OpenRouter API key */
  apiKey: string;
  /** Model ID to use */
  modelId: string;
  /** Previous conversation history */
  conversationHistory?: ChatMessage[];
  /** Reasoning config for models that support it */
  reasoningConfig?: {
    enabled: boolean;
    effort?: "medium" | "high";
    max_tokens?: number;
  };
}

/**
 * Result from preparing/starting a stream
 */
export interface PrepareResult {
  streamId: string;
  userMessageId: Id<"messages">;
  assistantMessageId: Id<"messages">;
}

/**
 * Return type for the usePersistentChat hook
 */
export interface UsePersistentChatResult {
  // ---- Stream State ----
  /** Current stream state: 'idle' | 'active' | 'reconnecting' */
  streamState: StreamState;
  /** The active stream ID, null when idle */
  activeStreamId: string | null;
  /** Whether a reconnection is needed (stream exists in DB but not locally) */
  needsReconnect: boolean;

  // ---- Stream Content ----
  /** Current stream body text */
  streamBody: string | null;
  /** Raw stream status from Convex */
  streamStatus: StreamStatus | null;

  // ---- Actions ----
  /** Start a new stream (prepare chat + fire HTTP request) */
  startStream: (options: StartStreamOptions) => Promise<PrepareResult>;
  /** Clear the current stream state (when stream completes or errors) */
  clearStream: () => void;
  /** Check if a stream was created in this browser session */
  isStreamDriven: (streamId: string) => boolean;
  /** Mark a stream as driven by this session (for reconnection scenarios) */
  markStreamAsDriven: (streamId: string) => void;

  // ---- Loading States ----
  /** True while preparing a new stream */
  isSubmitting: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the Convex site URL for HTTP endpoints
 */
function getConvexSiteUrl(): string {
  return process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "";
}

// ============================================================================
// Main Hook
// ============================================================================

export function usePersistentChat({
  chatId,
  userId,
  initialStreamId,
  onStreamComplete,
  onStreamError,
}: UsePersistentChatOptions): UsePersistentChatResult {
  // ---- Local State ----
  const [activeStreamId, setActiveStreamId] = useState<string | null>(
    initialStreamId ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track which stream IDs were created by THIS browser session
  // This is important for optimistic UI - we don't want to show loading
  // spinners for streams we're just observing, only for ones we created
  const drivenStreamIdsRef = useRef<Set<string>>(new Set());

  // Track if we've attempted reconnection (only do it once per mount)
  const hasAttemptedReconnect = useRef(false);

  // ---- Convex Mutations ----
  const prepareChat = useMutation(api.streaming.prepareChat);

  // ---- Reactive Queries ----

  // Query for active streams in DB (for reconnection on page reload)
  // This is reactive - it will update automatically when the DB changes
  const activeStreamFromDb = useQuery(
    api.messages.getActiveStream,
    { chatId, userId }
  );

  // Query for stream body content
  // Only query when we have an active stream
  const streamBodyData = useQuery(
    api.streaming.getStreamBody,
    activeStreamId ? { streamId: activeStreamId as any } : "skip"
  );

  // ---- Derived State ----

  // Extract stream text and status from query result
  const streamBody = streamBodyData?.text ?? null;
  const streamStatus = (streamBodyData?.status as StreamStatus) ?? null;

  // Determine if reconnection is needed:
  // Stream exists in DB but we don't have it locally yet
  const needsReconnect = useMemo(() => {
    return !!(activeStreamFromDb && !activeStreamId);
  }, [activeStreamFromDb, activeStreamId]);

  // Calculate stream state
  const streamState = useMemo<StreamState>(() => {
    if (!activeStreamId) {
      return needsReconnect ? "reconnecting" : "idle";
    }
    return "active";
  }, [activeStreamId, needsReconnect]);

  // ---- Effects ----

  /**
   * EFFECT 1: Auto-reconnect to active stream from database (page reload scenario)
   *
   * This effect handles the case where:
   * 1. User was in a chat with an active stream
   * 2. User reloads the page
   * 3. The query finds the active stream in DB
   * 4. We reconnect to show the streaming content
   *
   * Only runs ONCE per mount to avoid loops.
   */
  useEffect(() => {
    // Only attempt reconnection once per mount
    if (hasAttemptedReconnect.current) return;

    // Query still loading
    if (activeStreamFromDb === undefined) return;

    // No active stream in DB
    if (!activeStreamFromDb) return;

    // Already have an active stream locally
    if (activeStreamId) return;

    // Found an active stream from database - reconnect!
    hasAttemptedReconnect.current = true;
    setActiveStreamId(activeStreamFromDb);
  }, [activeStreamFromDb, activeStreamId]);

  /**
   * EFFECT 2: Sync initialStreamId prop changes to state
   *
   * This handles the case where:
   * 1. ChatRoom mounts BEFORE messages are fetched
   * 2. ChatRoomWrapper fetches messages and discovers a streaming message
   * 3. It passes the streamId as initialStreamId
   * 4. We need to sync this to our local state
   *
   * useState(initialValue) only uses the value on first render,
   * so we need this effect to handle prop changes after mount.
   */
  useEffect(() => {
    if (initialStreamId && !activeStreamId) {
      setActiveStreamId(initialStreamId);
    }
  }, [initialStreamId, activeStreamId]);

  /**
   * EFFECT 3: Handle stream completion/error
   *
   * This is a TRUE side effect - when the stream status changes to
   * done/error/timeout, we need to:
   * 1. Clear the local stream state
   * 2. Remove from driven set
   * 3. Call completion/error callbacks
   */
  useEffect(() => {
    if (!activeStreamId) return;

    const isTerminal =
      streamStatus === "done" ||
      streamStatus === "error" ||
      streamStatus === "timeout";

    if (isTerminal) {
      // Clean up driven tracking
      drivenStreamIdsRef.current.delete(activeStreamId);

      // Clear stream state
      setActiveStreamId(null);

      // Call appropriate callback
      if (streamStatus === "done") {
        onStreamComplete?.();
      } else if (streamStatus === "error" || streamStatus === "timeout") {
        const errorMessage =
          streamStatus === "timeout"
            ? "Stream timed out"
            : "Stream encountered an error";
        onStreamError?.(new Error(errorMessage));
      }
    }
  }, [activeStreamId, streamStatus, onStreamComplete, onStreamError]);

  // ---- Actions ----

  /**
   * Start a new stream
   *
   * This:
   * 1. Calls prepareChat mutation to create messages and stream
   * 2. Fires the HTTP request to start streaming (fire-and-forget)
   * 3. Updates local state to track the stream
   *
   * The HTTP request continues on Convex infrastructure even if client disconnects.
   */
  const startStream = useCallback(
    async (options: StartStreamOptions): Promise<PrepareResult> => {
      const {
        userContent,
        apiKey,
        modelId,
        conversationHistory = [],
        reasoningConfig,
      } = options;

      if (!userContent.trim()) {
        throw new Error("Message content cannot be empty");
      }

      setIsSubmitting(true);

      try {
        // Generate client-side IDs for optimistic UI
        const userMessageId = crypto.randomUUID();
        const assistantMessageId = crypto.randomUUID();

        // Create user message, stream, and assistant placeholder in Convex
        const result = await prepareChat({
          chatId,
          userId,
          userContent,
          userMessageId,
          assistantMessageId,
        });

        // Track this stream as driven by this session
        drivenStreamIdsRef.current.add(result.streamId as string);

        // Set active stream state
        setActiveStreamId(result.streamId as string);

        // Build messages array for the LLM
        const messages: ChatMessage[] = [
          ...conversationHistory,
          { role: "user", content: userContent },
        ];

        // Fire-and-forget: Start the stream on Convex
        // The stream continues even if we disconnect
        const convexSiteUrl = getConvexSiteUrl();
        if (convexSiteUrl) {
          fetch(`${convexSiteUrl}/stream-llm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              streamId: result.streamId,
              messageId: result.assistantMessageId,
              apiKey,
              modelId,
              messages,
              reasoningConfig,
            }),
          }).catch((error) => {
            console.error("Failed to start stream:", error);
            // Clear stream state on error
            drivenStreamIdsRef.current.delete(result.streamId as string);
            setActiveStreamId(null);
            onStreamError?.(
              error instanceof Error ? error : new Error("Failed to start stream")
            );
          });
        } else {
          console.error("NEXT_PUBLIC_CONVEX_SITE_URL not configured");
          throw new Error("Streaming service not configured");
        }

        setIsSubmitting(false);

        return {
          streamId: result.streamId as string,
          userMessageId: result.userMessageId,
          assistantMessageId: result.assistantMessageId,
        };
      } catch (error) {
        setIsSubmitting(false);
        const err =
          error instanceof Error ? error : new Error("Failed to start stream");
        onStreamError?.(err);
        throw err;
      }
    },
    [chatId, userId, prepareChat, onStreamError]
  );

  /**
   * Clear the current stream state
   * Call this when manually stopping or cleaning up
   */
  const clearStream = useCallback(() => {
    if (activeStreamId) {
      drivenStreamIdsRef.current.delete(activeStreamId);
    }
    setActiveStreamId(null);
  }, [activeStreamId]);

  /**
   * Check if a stream was created in this browser session
   * Used for optimistic UI decisions
   */
  const isStreamDriven = useCallback((streamId: string) => {
    return drivenStreamIdsRef.current.has(streamId);
  }, []);

  /**
   * Mark a stream as driven by this session
   * Useful when reconnecting to a stream the user created before reload
   */
  const markStreamAsDriven = useCallback((streamId: string) => {
    drivenStreamIdsRef.current.add(streamId);
  }, []);

  // ---- Return ----

  return {
    // Stream state
    streamState,
    activeStreamId,
    needsReconnect,

    // Stream content
    streamBody,
    streamStatus,

    // Actions
    startStream,
    clearStream,
    isStreamDriven,
    markStreamAsDriven,

    // Loading states
    isSubmitting,
  };
}

// ============================================================================
// Legacy Export (for backwards compatibility)
// ============================================================================

/**
 * @deprecated Use usePersistentChat instead
 */
export type StreamingMessage = {
  streamId: string;
  assistantMessageId: string;
  userMessageId: string;
  status: "streaming" | "complete" | "error";
};

/**
 * @deprecated Use UsePersistentChatOptions instead
 */
export type UsePersistentChatOptionsLegacy = {
  chatId: Id<"chats">;
  userId: Id<"users">;
  onError?: (error: Error) => void;
};

/**
 * @deprecated Use StartStreamOptions instead
 */
export type SendMessageOptions = {
  apiKey: string;
  modelId: string;
  conversationHistory?: ChatMessage[];
  reasoningConfig?: {
    enabled: boolean;
    effort?: "medium" | "high";
    max_tokens?: number;
  };
};

// ============================================================================
// useMessageStream Hook (kept for potential use in message-level streaming)
// ============================================================================

/**
 * Hook to consume a specific stream's content by streamId
 *
 * This hook is useful for displaying stream content at the message level,
 * where each message component can independently subscribe to its stream.
 *
 * @param streamId - The stream ID to subscribe to, or null
 * @returns Stream content and status
 */
export function useMessageStream(streamId: string | null) {
  const streamBody = useQuery(
    api.streaming.getStreamBody,
    streamId ? { streamId: streamId as any } : "skip"
  );

  const text = streamBody?.text || "";
  const status = (streamBody?.status as StreamStatus) ?? null;

  return {
    text,
    status,
    isLoading: status === "pending" || status === "streaming",
    isComplete: status === "done",
    isError: status === "error" || status === "timeout",
  };
}
