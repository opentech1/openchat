"use client";

import { useEffect, useMemo, useState } from "react";
import { Provider as ChatStoreProvider } from "@ai-sdk-tools/store";
import dynamic from "next/dynamic";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";
import { ChatLoader } from "@/components/ui/nice-loader";
import { ChatErrorBoundary } from "@/components/chat-error-boundary";

// Lazy load the heavy ChatRoom component (600+ lines)
const ChatRoom = dynamic(() => import("@/components/chat-room"), {
  ssr: false,
  loading: () => <ChatLoader />,
});

type ChatRoomProps = {
  chatId: string;
  initialMessages: Array<{
    id: string;
    role: string;
    content: string;
    reasoning?: string;
    createdAt: string | Date;
  }>;
};

export default function ChatRoomWrapper(props: ChatRoomProps) {
  const [mounted, setMounted] = useState(false);
  const initialUiMessages = useMemo(
    () =>
      props.initialMessages.map((message) =>
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
    [props.initialMessages],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <ChatLoader />;
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
