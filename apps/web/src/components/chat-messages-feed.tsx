"use client";

import { useMemo, useRef } from "react";
import type { UIMessage } from "ai";

import { ChatMessagesPanel } from "@/components/chat-messages-panel";
import type { NormalizedMessage } from "@/lib/chat-message-utils";
import {
  mergeNormalizedMessages,
  normalizeUiMessage,
} from "@/lib/chat-message-utils";

export type ChatMessagesFeedProps = {
  initialMessages: NormalizedMessage[];
  optimisticMessages: UIMessage<{ createdAt?: string }>[];
  paddingBottom: number;
  className?: string;
  loading?: boolean;
  isStreaming?: boolean;
  userId?: string | null;
};

export function ChatMessagesFeed({
  initialMessages,
  optimisticMessages,
  paddingBottom,
  className,
  loading = false,
  isStreaming = false,
  userId,
}: ChatMessagesFeedProps) {
  const optimisticNormalized = useMemo(
    () => optimisticMessages.map(normalizeUiMessage),
    [optimisticMessages],
  );

  const lastMergedRef = useRef<NormalizedMessage[] | null>(null);
  const prevByIdRef = useRef<Map<string, NormalizedMessage>>(new Map());
  const merged = useMemo(() => {
    const next = mergeNormalizedMessages(initialMessages, optimisticNormalized);
    const prev = lastMergedRef.current;
    if (!prev) {
      lastMergedRef.current = next;
      prevByIdRef.current = new Map(next.map((msg) => [msg.id, msg]));
      return next;
    }
    const stabilized = next.map((msg) => {
      const previous = prevByIdRef.current.get(msg.id);
      if (!previous) return msg;
      const sameRole = previous.role === msg.role;
      const sameContent = previous.content === msg.content;
      const sameCreated =
        previous.createdAt.getTime() === msg.createdAt.getTime();
      const prevUpdated = previous.updatedAt?.getTime() ?? null;
      const nextUpdated = msg.updatedAt?.getTime() ?? null;

      // CRITICAL FIX: Compare parts array to detect reasoning changes
      const sameParts =
        (previous.parts === msg.parts) ||
        (!previous.parts && !msg.parts) ||
        (previous.parts?.length === msg.parts?.length &&
         previous.parts?.every((p, i) =>
           p.type === msg.parts![i]?.type && p.text === msg.parts![i]?.text
         ));

      // Compare attachments
      const sameAttachments =
        (previous.attachments === msg.attachments) ||
        (!previous.attachments && !msg.attachments) ||
        (previous.attachments?.length === msg.attachments?.length &&
         previous.attachments?.every((a, i) =>
           a.storageId === msg.attachments![i]?.storageId
         ));

      if (
        sameRole &&
        sameContent &&
        sameCreated &&
        prevUpdated === nextUpdated &&
        sameParts &&
        sameAttachments
      ) {
        return previous;
      }
      return msg;
    });
    lastMergedRef.current = stabilized;
    prevByIdRef.current = new Map(stabilized.map((msg) => [msg.id, msg]));
    return stabilized;
  }, [initialMessages, optimisticNormalized]);

  // PERFORMANCE FIX: Memoize message mapping to prevent ChatMessagesPanel re-renders
  const mappedMessages = useMemo(
    () =>
      merged.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        parts: msg.parts,
        thinkingTimeMs: msg.thinkingTimeMs,
        attachments: msg.attachments,
      })),
    [merged]
  );

  return (
    <ChatMessagesPanel
      messages={mappedMessages}
      paddingBottom={paddingBottom}
      className={className}
      loading={loading}
      isStreaming={isStreaming}
      userId={userId}
    />
  );
}

export default ChatMessagesFeed;
