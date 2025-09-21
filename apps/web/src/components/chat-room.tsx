"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import type { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";

import { Message } from "@/components/ai-elements/message";
import ChatComposer from "@/components/chat-composer";
import { useChatMessages } from "@/lib/electric/workspace-db";

function normalizeMessage(message: { id: string; role: string; content: string; createdAt?: string | Date | null }) {
  return {
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
    createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
  };
}

function fromUiMessage(message: UIMessage<{ createdAt?: string }>) {
  const text = message.parts
    .filter((part): part is { type: "text"; text: string } => part?.type === "text")
    .map((part) => part.text)
    .join("");
  return {
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: text,
    createdAt: message.metadata?.createdAt ? new Date(message.metadata.createdAt) : new Date(),
  };
}

type NormalizedMessage = ReturnType<typeof normalizeMessage>;

type ChatRoomProps = {
  chatId: string;
  initialMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string | Date;
  }>;
};

export default function ChatRoom({ chatId, initialMessages }: ChatRoomProps) {
  const auth = useAuth();
  const devBypassEnabled = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";
  const memoDevUser =
    typeof window !== "undefined" ? ((window as any).__DEV_USER_ID__ as string | undefined) : undefined;
  const workspaceId =
    auth.userId || memoDevUser || (devBypassEnabled ? process.env.NEXT_PUBLIC_DEV_USER_ID || "dev-user" : null);

  const normalizedInitial = useMemo(
    () => initialMessages.map(normalizeMessage),
    [initialMessages],
  );

  const listRef = useRef<HTMLDivElement>(null);

  const { messages, setMessages, sendMessage, status } = useChat<UIMessage<{ createdAt?: string }>>({
    id: chatId,
    body: { chatId },
    credentials: "include",
    headers: workspaceId ? { "x-user-id": workspaceId } : undefined,
    messages: normalizedInitial.map((msg) => ({
      id: msg.id,
      role: msg.role,
      parts: [{ type: "text" as const, text: msg.content }],
      metadata: { createdAt: msg.createdAt.toISOString() },
    })),
    onFinish: async ({ message, isAbort, isError }) => {
      if (isAbort || isError) return;
      const assistantCreatedAt = new Date().toISOString();
      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id
            ? { ...item, metadata: { ...item.metadata, createdAt: assistantCreatedAt } }
            : item,
        ),
      );
    },
    onError: (error) => {
      console.error("Chat stream error", error);
    },
  });

const electricMessages = useChatMessages(
  workspaceId,
  chatId,
  normalizedInitial.map((msg) => ({
    id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    })),
  );

const baseMessages = useMemo(() => {
  if (!electricMessages.enabled) return normalizedInitial;
  if (!electricMessages.isReady) return normalizedInitial;
  return electricMessages.data.map((row) =>
    normalizeMessage({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
    }),
  );
}, [electricMessages.enabled, electricMessages.isReady, electricMessages.data, normalizedInitial]);

  const optimisticMessages = useMemo(
    () => messages.map((msg) => normalizeMessage(fromUiMessage(msg))),
    [messages],
  );

  const displayMessages = useMemo(() => {
    const map = new Map<string, NormalizedMessage>();
    for (const entry of baseMessages) map.set(entry.id, entry);
    for (const optimistic of optimisticMessages) map.set(optimistic.id, optimistic);
    return Array.from(map.values()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [baseMessages, optimisticMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [displayMessages]);

  const handleSend = async (inputText: string) => {
    const content = inputText.trim();
    if (!content) return;
    const id = crypto.randomUUID?.() ?? `${Date.now()}`;
    const createdAt = new Date().toISOString();
    try {
      await sendMessage({
        id,
        role: "user",
        parts: [{ type: "text", text: content }],
        metadata: { createdAt },
      });
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-1 flex-col gap-3">
      <div ref={listRef} className="flex-1 overflow-y-auto rounded-xl p-4 pb-32">
        {displayMessages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No messages yet. Say hi!</p>
        ) : (
          <div className="flex flex-col">
            {displayMessages.map((msg) => (
              <Message key={msg.id} from={msg.role as "user" | "assistant"} className={msg.role === "assistant" ? "justify-start flex-row" : undefined}>
                {msg.role === "assistant" ? (
                  <div className="text-foreground text-sm leading-6 whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div className="border border-border rounded-lg px-4 py-2 text-sm whitespace-pre-wrap">{msg.content}</div>
                )}
              </Message>
            ))}
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-10 flex justify-center transition-all duration-300 ease-in-out md:left-[calc(var(--sb-width)+1.5rem)] md:right-6">
        <div className="pointer-events-auto w-full max-w-3xl">
          <ChatComposer placeholder="Ask OpenChat a question..." disabled={busy} onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
