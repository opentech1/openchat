"use client";

import { useMemo, useRef } from "react";
import type { UIMessage } from "ai";

import { ChatMessagesPanel } from "@/components/chat-messages-panel";
import type { NormalizedMessage } from "@/lib/chat-message-utils";
import {
	mergeNormalizedMessages,
	normalizeUiMessage,
} from "@/lib/chat-message-utils";

export type ChatMessagesFeedProps = {
	initialMessages: NormalizedMessage[];
	optimisticMessages: UIMessage<{ createdAt?: string }> [];
	paddingBottom: number;
	className?: string;
};

export function ChatMessagesFeed({
	initialMessages,
	optimisticMessages,
	paddingBottom,
	className,
}: ChatMessagesFeedProps) {
	const optimisticNormalized = useMemo(
		() => optimisticMessages.map(normalizeUiMessage),
		[optimisticMessages],
	);

	const lastMergedRef = useRef<NormalizedMessage[] | null>(null);
	const prevByIdRef = useRef<Map<string, NormalizedMessage>>(new Map());
	
	const merged = useMemo(() => {
		const next = mergeNormalizedMessages(initialMessages, optimisticNormalized);
		const prev = lastMergedRef.current;
		if (!prev || prev.length !== next.length) {
			lastMergedRef.current = next;
			prevByIdRef.current = new Map(next.map((msg) => [msg.id, msg]));
			return next;
		}
		
		const prevById = prevByIdRef.current;
		const stabilized = next.map((msg) => {
			const previous = prevById.get(msg.id);
			if (!previous) return msg;
			if (
				previous.role === msg.role &&
				previous.content === msg.content &&
				previous.createdAt.getTime() === msg.createdAt.getTime() &&
				(previous.updatedAt?.getTime() ?? null) === (msg.updatedAt?.getTime() ?? null)
			) {
				return previous;
			}
			return msg;
		});
		
		lastMergedRef.current = stabilized;
		prevByIdRef.current = new Map(stabilized.map((msg) => [msg.id, msg]));
		return stabilized;
	}, [initialMessages, optimisticNormalized]);

	return (
		<ChatMessagesPanel
			messages={merged.map((msg) => ({ id: msg.id, role: msg.role, content: msg.content }))}
			paddingBottom={paddingBottom}
			className={className}
		/>
	);
}

export default ChatMessagesFeed;
