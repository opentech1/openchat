import * as React from "react";
import { createFileRoute, useParams, redirect } from "@tanstack/react-router";
import ChatRoomWrapper from "@web/components/chat-room-wrapper";
import type { MessageRow } from "@web/types/server-router";
import { client } from "@start/utils/orpc";

export const Route = createFileRoute("/dashboard/chat/$id")({
  loader: async ({ params }) => {
    const res = await fetch("/api/auth/get-session", { credentials: "include" });
    const data = res.ok ? await res.json().catch(() => null) : null;
    if (!data?.user?.id) throw redirect({ to: "/auth/sign-in" });
    const fetchedMessages: MessageRow[] = await client.messages
      .list({ chatId: params.id })
      .catch(() => [] as MessageRow[]);
    const initialMessages = fetchedMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: (message as any).createdAt ?? new Date().toISOString(),
    }));
    return { chatId: params.id, initialMessages };
  },
  component: ChatRoom,
});

function ChatRoom() {
  const { chatId, initialMessages } = Route.useLoaderData() as { chatId: string; initialMessages: Array<any> };
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col gap-0 overflow-hidden min-h-0 p-4 md:p-6">
      <ChatRoomWrapper chatId={chatId} initialMessages={initialMessages} />
    </div>
  );
}
