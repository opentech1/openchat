"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { ChatSkeleton } from "@/components/skeletons/chat-skeleton";

/**
 * Lazy-loaded ChatMessagesFeed component.
 *
 * ChatMessagesFeed includes ChatMessagesPanel which is ~32KB and imports:
 * - @radix-ui/react-scroll-area
 * - SafeStreamdown (markdown rendering)
 * - Reasoning and ToolInvocation components
 * - FilePreview component
 *
 * Dynamic import reduces initial bundle and speeds up dev compilation.
 */
const ChatMessagesFeed = dynamic(
  () => import("@/components/chat-messages-feed"),
  {
    loading: () => <ChatSkeleton messageCount={3} showComposer={false} />,
    ssr: false,
  }
);

export function ChatMessagesFeedLazy(props: ComponentProps<typeof ChatMessagesFeed>) {
  return <ChatMessagesFeed {...props} />;
}

export default ChatMessagesFeedLazy;
