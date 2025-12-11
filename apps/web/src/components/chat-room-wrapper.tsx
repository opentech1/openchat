"use client";

import { useEffect, useMemo, useState } from "react";
import { Provider as ChatStoreProvider } from "@ai-sdk-tools/store";
import dynamic from "next/dynamic";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";
import { ChatLoader } from "@/components/ui/nice-loader";
import { ChatErrorBoundary } from "@/components/chat-error-boundary";

// Lazy load the heavy ChatRoom component (600+ lines)
// NOTE: Don't add loading here - the wrapper already handles loading state
// Adding both causes double "Loading chat..." indicators
const ChatRoom = dynamic(() => import("@/components/chat-room"), {
  ssr: false,
});

type MessageData = {
  id: string;
  role: string;
  content: string;
  reasoning?: string;
  thinkingTimeMs?: number;
  createdAt: string | Date;
  // STREAM RECONNECTION: Include status and streamId
  status?: string | null;
  streamId?: string | null;
  attachments?: Array<{
    storageId: string;
    filename: string;
    contentType: string;
    size: number;
    uploadedAt: number;
  }>;
};

type ChatRoomProps = {
  chatId: string;
  initialMessages: MessageData[];
  // STREAM RECONNECTION: Pass active stream info to ChatRoom
  initialStreamId?: string | null;
};

export default function ChatRoomWrapper(props: ChatRoomProps) {
  const [mounted, setMounted] = useState(false);

  // NOTE: Messages are loaded via Convex real-time queries in ChatRoom component.
  // The initialMessages prop provides server-side prefetched data for instant display,
  // and ChatRoom's useChatSession hook handles real-time updates.

  const initialUiMessages = useMemo(
    () =>
      props.initialMessages.map((message) =>
        toUiMessage(
          normalizeMessage({
            id: message.id,
            role: message.role,
            content: message.content,
            reasoning: message.reasoning,
            thinkingTimeMs: message.thinkingTimeMs,
            attachments: message.attachments,
            created_at: message.createdAt,
          }),
        ),
      ),
    [props.initialMessages],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // INSTANT DISPLAY: Show chat immediately with cached/initial data
  // Convex queries will load data instantly from cache and update in real-time
  // No need to wait for mounting or loading - render immediately!
  return (
    <div className="animate-fade-in">
      <ChatErrorBoundary chatId={props.chatId}>
        <ChatStoreProvider initialMessages={initialUiMessages}>
          {mounted ? (
            <ChatRoom
              chatId={props.chatId}
              initialMessages={props.initialMessages}
              initialStreamId={props.initialStreamId}
            />
          ) : (
            <ChatLoader />
          )}
        </ChatStoreProvider>
      </ChatErrorBoundary>
    </div>
  );
}
