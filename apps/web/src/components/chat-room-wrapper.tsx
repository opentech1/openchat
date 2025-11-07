"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Provider as ChatStoreProvider } from "@ai-sdk-tools/store";
import dynamic from "next/dynamic";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";

// Lazy load the heavy ChatRoom component (600+ lines)
const ChatRoom = dynamic(() => import("@/components/chat-room"), {
  ssr: false,
  loading: () => <ChatRoomSkeleton />,
});

function ChatRoomSkeleton() {
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
      </div>
    </div>
  );
}

type ChatRoomProps = {
  chatId: string;
  initialMessages: Array<{
    id: string;
    role: string;
    content: string;
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
            created_at: message.createdAt,
          }),
        ),
      ),
    [props.initialMessages],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <ChatRoomSkeleton />;
  return (
    <ChatStoreProvider initialMessages={initialUiMessages}>
      <ChatRoom {...props} />
    </ChatStoreProvider>
  );
}
