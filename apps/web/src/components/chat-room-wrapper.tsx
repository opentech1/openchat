"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Provider as ChatStoreProvider } from "@ai-sdk-tools/store";
import dynamic from "next/dynamic";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";
import { ChatLoader } from "@/components/ui/nice-loader";
import { ChatErrorBoundary } from "@/components/chat-error-boundary";
import { logError } from "@/lib/logger";

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
  const [messages, setMessages] = useState<MessageData[]>(props.initialMessages);
  const [isLoading, setIsLoading] = useState(props.initialMessages.length === 0);
  // STREAM RECONNECTION: Track active stream for reconnection
  const [activeStreamId, setActiveStreamId] = useState<string | null>(props.initialStreamId ?? null);
  const hasFetchedRef = useRef(false);

  // CLIENT-SIDE MESSAGE FETCHING: Load messages from API when initialMessages is empty
  // This handles the case where server-side fetching isn't available (e.g., Edge environments)
  useEffect(() => {
    if (hasFetchedRef.current) return;
    if (props.initialMessages.length > 0) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/chats/${props.chatId}/prefetch`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.messages && Array.isArray(data.messages)) {
            const fetchedMessages = data.messages.map((m: { id: string; role: string; content: string; reasoning?: string; thinkingTimeMs?: number; createdAt: string; status?: string; streamId?: string; attachments?: MessageData["attachments"] }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              reasoning: m.reasoning,
              thinkingTimeMs: m.thinkingTimeMs,
              createdAt: m.createdAt,
              status: m.status,
              streamId: m.streamId,
              attachments: m.attachments,
            }));
            setMessages(fetchedMessages);

            // STREAM RECONNECTION: Detect streaming messages and reconnect
            const streamingMessage = fetchedMessages.find(
              (m: MessageData) => m.status === "streaming" && m.streamId
            );
            if (streamingMessage?.streamId) {
              setActiveStreamId(streamingMessage.streamId);
            }

            hasFetchedRef.current = true;
          }
        }
      } catch (error) {
        logError("Failed to fetch chat messages", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchMessages();
  }, [props.chatId, props.initialMessages.length]);

  const initialUiMessages = useMemo(
    () =>
      messages.map((message) =>
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
    [messages],
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
            // CRITICAL FIX: Pass the fetched messages, not props.initialMessages
            // When initialMessages is empty, we fetch client-side and update `messages` state
            // We must pass the updated messages to ChatRoom, not the stale props
            <ChatRoom
              chatId={props.chatId}
              initialMessages={messages}
              initialStreamId={activeStreamId}
            />
          ) : (
            <ChatLoader />
          )}
        </ChatStoreProvider>
      </ChatErrorBoundary>
    </div>
  );
}
