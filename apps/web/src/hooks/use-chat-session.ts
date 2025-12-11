/**
 * useChatSession - Reactive hook for chat session data using Convex queries
 *
 * This hook consolidates chat loading logic that was previously scattered across
 * multiple useEffects. It follows the T3Chat pattern of using reactive Convex
 * queries instead of imperative useEffect-based data fetching.
 *
 * Key principles:
 * - NO useEffect for data fetching - all data comes from reactive Convex queries
 * - Undefined = loading (per T3Chat convention)
 * - Proper "skip" pattern when chatId or userId is unavailable
 * - Returns UI-normalized message format compatible with ChatRoom
 *
 * IMPORTANT: This hook does NOT handle stream state. Stream reconnection logic
 * is tightly coupled to optimistic UI state from useChat and should be handled
 * separately in ChatRoom. This hook ONLY handles chat + messages data fetching.
 *
 * Error handling: Convex uses error boundaries for query errors. This hook
 * returns error: null. If a Convex query fails, it will throw and be caught
 * by the nearest ErrorBoundary component.
 *
 * @example
 * ```tsx
 * function ChatRoom({ chatId }: { chatId: string }) {
 *   const { convexUser } = useConvexUser();
 *   const session = useChatSession({
 *     chatId,
 *     userId: convexUser?._id ?? null,
 *   });
 *
 *   if (session.isSkipped) return <LoginPrompt />;
 *   if (session.isLoading) return <LoadingSkeleton />;
 *   if (!session.chat) return <NotFound />;
 *
 *   return <ChatContent messages={session.messages} />;
 * }
 * ```
 */

import { useConvexQuery } from "@/hooks/use-convex-query";
import { normalizeMessage } from "@/lib/chat-message-utils";
import type { NormalizedMessage } from "@/lib/chat-message-utils";
import { api } from "@server/convex/_generated/api";
import type { Id } from "@server/convex/_generated/dataModel";
import { toConvexChatId, isValidConvexId } from "@/lib/type-converters";
import { useMemo } from "react";

/**
 * Chat document from Convex
 */
export type Chat = {
  _id: Id<"chats">;
  _creationTime: number;
  userId: Id<"users">;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  deletedAt?: number;
  messageCount?: number;
};

/**
 * Message document from Convex (raw database format)
 */
type ConvexMessage = {
  _id: Id<"messages">;
  clientMessageId?: string;
  role: string;
  content: string;
  reasoning?: string;
  thinkingTimeMs?: number;
  status?: string;
  streamId?: string;
  attachments?: Array<{
    storageId: Id<"_storage">;
    filename: string;
    contentType: string;
    size: number;
    uploadedAt: number;
    url?: string;
  }>;
  createdAt: number;
  deletedAt?: number;
};

/**
 * UI-normalized message format (what ChatRoom expects)
 * This matches the NormalizedMessage type from chat-message-utils.ts
 */
export type UIMessage = NormalizedMessage;

/**
 * Return type for useChatSession hook
 */
export interface ChatSessionResult {
  /** The chat document, null if not found */
  chat: Chat | null;
  /** Array of UI-normalized messages, null if chat not found */
  messages: UIMessage[] | null;
  /** True while any query is still loading */
  isLoading: boolean;
  /** True when chatId is invalid or userId is not available (query skipped) */
  isSkipped: boolean;
}

/**
 * Input options for useChatSession hook
 */
export interface UseChatSessionOptions {
  /** The chat ID string (will be validated and converted to Convex ID) */
  chatId: string | undefined;
  /** The authenticated user's Convex ID */
  userId: Id<"users"> | null | undefined;
}

/**
 * Converts a Convex message to UI-normalized format.
 * Uses the shared normalizeMessage utility for consistent formatting.
 */
function toUIMessage(msg: ConvexMessage): UIMessage {
  return normalizeMessage({
    id: msg.clientMessageId ?? msg._id,
    role: msg.role,
    content: msg.content,
    reasoning: msg.reasoning,
    thinkingTimeMs: msg.thinkingTimeMs,
    attachments: msg.attachments?.map((a) => ({
      storageId: String(a.storageId),
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      uploadedAt: a.uploadedAt,
    })),
    createdAt: msg.createdAt,
  });
}

/**
 * Hook for managing chat session data with reactive Convex queries.
 *
 * This hook handles:
 * 1. Chat document fetching
 * 2. Message list fetching with UI normalization
 *
 * This hook does NOT handle:
 * - Stream state (handled separately in ChatRoom due to optimistic UI coupling)
 * - Error throwing (Convex uses error boundaries)
 *
 * @param options - Configuration including chatId and userId
 * @returns ChatSessionResult with chat, messages, loading, and skip state
 */
export function useChatSession({
  chatId,
  userId,
}: UseChatSessionOptions): ChatSessionResult {
  // Validate and convert chatId to Convex ID format
  // Using the safe pattern: invalid ID = skip query
  const validChatId =
    chatId && isValidConvexId(chatId) ? toConvexChatId(chatId) : null;

  // Determine if we can make queries
  const canQuery = validChatId !== null && userId !== null && userId !== undefined;

  // Query for the chat document using our wrapper hook
  const {
    data: chat,
    isLoading: chatLoading,
    isSkipped: chatSkipped,
  } = useConvexQuery(
    api.chats.get,
    canQuery ? { chatId: validChatId, userId } : "skip"
  );

  // Query for messages in the chat using our wrapper hook
  const {
    data: rawMessages,
    isLoading: messagesLoading,
    isSkipped: messagesSkipped,
  } = useConvexQuery(
    api.messages.list,
    canQuery ? { chatId: validChatId, userId } : "skip"
  );

  // Transform messages to UI format
  // Memoize to avoid unnecessary re-renders
  const messages = useMemo(() => {
    if (rawMessages === undefined || rawMessages === null) {
      return null;
    }
    return rawMessages.map(toUIMessage);
  }, [rawMessages]);

  // Calculate overall states
  const isSkipped = chatSkipped || messagesSkipped;
  const isLoading = !isSkipped && (chatLoading || messagesLoading);

  return {
    chat: chat ?? null,
    messages,
    isLoading,
    isSkipped,
  };
}
