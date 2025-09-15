"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Message } from "@/components/ai-elements/message";
import ChatComposer from "@/components/chat-composer";
import { connect, subscribe, unsubscribe, type Envelope } from "@/lib/sync";

type Role = "user" | "assistant";
type Msg = { id: string; role: string; content: string; createdAt: Date };

export default function ChatRoom({ chatId, initialMessages }: { chatId: string; initialMessages: Array<Omit<Msg, "createdAt"> & { createdAt: string | Date }> }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState(() =>
    (initialMessages || []).map((m) => ({ ...m, createdAt: new Date(m.createdAt as any) }))
  );

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      // optimistic update
      const now = new Date();
      const userMsg = { id: crypto.randomUUID?.() || String(now.getTime()), role: "user", content, createdAt: now } as any;
      const asstMsg = { id: crypto.randomUUID?.() || String(now.getTime() + 1), role: "assistant", content: "test", createdAt: new Date(now.getTime() + 1) } as any;
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      // persist via Next API (server-side auth)
      await fetch("/api/chat/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId, content }) });
    },
  });

  const sortedMessages = useMemo(() => {
    const arr = [...(messages ?? [])];
    return arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages]);

  useEffect(() => {
    // On mount, scroll to bottom
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0);
  }, []);

  useEffect(() => {
    void connect();
    const topic = `chat:${chatId}`;
    const handler = (evt: Envelope) => {
      if (evt.type !== "chat.new") return;
      const d = evt.data as any;
      setMessages((prev) => {
        if (prev.some((m) => m.id === d.messageId)) return prev;
        const next = prev.concat([{ id: d.messageId, role: d.role, content: d.content, createdAt: new Date(d.createdAt) }]);
        return next;
      });
    };
    const off = subscribe(topic, handler);
    return () => {
      off();
    };
  }, [chatId]);

  return (
    <div className="flex h-[calc(100svh-6rem)] flex-col gap-3">
      <div ref={listRef} className="flex-1 overflow-y-auto rounded-xl p-4">
        {sortedMessages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No messages yet. Say hi!</p>
        ) : (
          <div className="flex flex-col">
            {sortedMessages.map((m) => {
              const role: Role = m.role === "user" ? "user" : "assistant";
              return (
              <Message key={m.id} from={role} className={role === "assistant" ? "justify-start flex-row" : undefined}>
                {role === "assistant" ? (
                  <div className="text-foreground text-sm leading-6 whitespace-pre-wrap">{m.content}</div>
                ) : (
                  <div className="border border-border rounded-lg px-4 py-2 text-sm whitespace-pre-wrap">
                    {m.content}
                  </div>
                )}
              </Message>
              );
            })}
          </div>
        )}
      </div>

      <ChatComposer
        placeholder="Ask OpenChat a question..."
        disabled={sendMutation.isPending}
        onSend={async (text) => { await sendMutation.mutateAsync(text); }}
      />
    </div>
  );
}
