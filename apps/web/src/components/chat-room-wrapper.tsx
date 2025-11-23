"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Provider as ChatStoreProvider } from "@ai-sdk-tools/store";
import dynamic from "next/dynamic";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";
import { ChatLoader } from "@/components/ui/nice-loader";
import { ChatErrorBoundary } from "@/components/chat-error-boundary";
import { logError } from "@/lib/logger";

// Lazy load the heavy ChatRoom component (600+ lines)
const ChatRoom = dynamic(() => import("@/components/chat-room"), {
  ssr: false,
  loading: () => <ChatLoader />,
});

type MessageData = {
  id: string;
  role: string;
  content: string;
  reasoning?: string;
  createdAt: string | Date;
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
};

export default function ChatRoomWrapper(props: ChatRoomProps) {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<MessageData[]>(props.initialMessages);
  const [isLoading, setIsLoading] = useState(props.initialMessages.length === 0);
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
            setMessages(data.messages.map((m: { id: string; role: string; content: string; reasoning?: string; createdAt: string; attachments?: MessageData["attachments"] }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              reasoning: m.reasoning,
              createdAt: m.createdAt,
              attachments: m.attachments,
            })));
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
            created_at: message.createdAt,
          }),
        ),
      ),
    [messages],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) return <ChatLoader />;
  return (
    <div className="animate-fade-in">
      <ChatErrorBoundary chatId={props.chatId}>
        <ChatStoreProvider initialMessages={initialUiMessages}>
          <ChatRoom {...props} />
        </ChatStoreProvider>
      </ChatErrorBoundary>
    </div>
  );
}
