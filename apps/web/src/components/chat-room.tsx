"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Message } from "@/components/ai-elements/message";
import ChatComposer from "@/components/chat-composer";
import { connect, subscribe, type Envelope } from "@/lib/sync";

type Role = "user" | "assistant";
type Msg = { id: string; role: string; content: string; createdAt: Date };

type InitialMessage = Omit<Msg, "createdAt"> & { createdAt: string | Date };

type SortedMessages = Array<Msg>;

const SCROLL_THRESHOLD = 80;

function normaliseMessages(messages: InitialMessage[]): SortedMessages {
	return [...messages]
		.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }))
		.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function insertMessage(list: SortedMessages, entry: Msg): SortedMessages {
	if (list.some((item) => item.id === entry.id)) {
		return list;
	}

	const next = [...list];
	const ts = entry.createdAt.getTime();
	let index = next.findIndex((item) => item.createdAt.getTime() > ts);

	if (index === -1) {
		next.push(entry);
	} else {
		next.splice(index, 0, entry);
	}

	return next;
}

export default function ChatRoom({
	chatId,
	initialMessages,
}: {
	chatId: string;
	initialMessages: Array<InitialMessage>;
}) {
	const listRef = useRef<HTMLDivElement>(null);
	const autoScrollRef = useRef(true);
	const previousCountRef = useRef(0);
	const [messages, setMessages] = useState<SortedMessages>(() =>
		normaliseMessages(initialMessages || []),
	);

	const sendMutation = useMutation({
		mutationFn: async (content: string) => {
			const now = new Date();
			const userMsg: Msg = {
				id: crypto.randomUUID?.() || String(now.getTime()),
				role: "user",
				content,
				createdAt: now,
			};
			const assistantMsg: Msg = {
				id: crypto.randomUUID?.() || String(now.getTime() + 1),
				role: "assistant",
				content: "test",
				createdAt: new Date(now.getTime() + 1),
			};

			setMessages((prev) => insertMessage(insertMessage(prev, userMsg), assistantMsg));

			await fetch("/api/chat/send", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ chatId, content }),
			});
		},
	});

	useEffect(() => {
		const list = listRef.current;
		if (!list) return;

		const updateScrollState = () => {
			autoScrollRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < SCROLL_THRESHOLD;
		};

		updateScrollState();
		list.addEventListener("scroll", updateScrollState, { passive: true });
		return () => {
			list.removeEventListener("scroll", updateScrollState);
		};
	}, []);

	useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return;

		if (messages.length === 0) {
			list.scrollTop = 0;
			previousCountRef.current = 0;
			return;
		}

		if (messages.length > previousCountRef.current && autoScrollRef.current) {
			list.scrollTop = list.scrollHeight;
		}

		previousCountRef.current = messages.length;
	}, [messages]);

	useEffect(() => {
		void connect();
		const topic = `chat:${chatId}`;

		const handler = (evt: Envelope) => {
			if (evt.type !== "chat.new") return;
			const data = evt.data as { messageId: string; role: string; content: string; createdAt: string | number };
			const nextMessage: Msg = {
				id: data.messageId,
				role: data.role,
				content: data.content,
				createdAt: new Date(data.createdAt),
			};

			setMessages((prev) => insertMessage(prev, nextMessage));
		};

		const off = subscribe(topic, handler);
		return () => {
			off();
		};
	}, [chatId]);

	return (
		<div className="flex h-[calc(100svh-6rem)] flex-col gap-3">
			<div ref={listRef} className="flex-1 overflow-y-auto rounded-xl p-4">
				{messages.length === 0 ? (
					<p className="text-muted-foreground text-sm">No messages yet. Say hi!</p>
				) : (
					<div className="flex flex-col">
						{messages.map((m) => {
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
				onSend={async (text) => {
					await sendMutation.mutateAsync(text);
				}}
			/>
		</div>
	);
}
