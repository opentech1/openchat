"use client";

import { useMemo, useRef } from "react";
import type { UIMessage } from "ai";

import { ChatMessagesPanel } from "@/components/chat-messages-panel";
import type { NormalizedMessage } from "@/lib/chat-message-utils";
import {
	mergeNormalizedMessages,
	normalizeMessage,
	normalizeUiMessage,
} from "@/lib/chat-message-utils";

export type ChatMessagesFeedProps = {
	initialMessages: NormalizedMessage[];
	optimisticMessages: UIMessage<{ createdAt?: string }> [];
	paddingBottom: number;
	className?: string;
	loading?: boolean;
};

export function ChatMessagesFeed({
	initialMessages,
	optimisticMessages,
	paddingBottom,
	className,
	loading = false,
}: ChatMessagesFeedProps) {
	const optimisticNormalized = useMemo(
		() => optimisticMessages.map(normalizeUiMessage),
		[optimisticMessages],
	);

	const lastMergedRef = useRef<NormalizedMessage[] | null>(null);
	const merged = useMemo(() => {
		const next = mergeNormalizedMessages(initialMessages, optimisticNormalized);
		const prev = lastMergedRef.current;
		if (!prev) {
			lastMergedRef.current = next;
			return next;
		}
		const prevById = new Map(prev.map((msg) => [msg.id, msg]));
		const stabilized = next.map((msg) => {
			const previous = prevById.get(msg.id);
			if (!previous) return msg;
			const sameRole = previous.role === msg.role;
			const sameContent = previous.content === msg.content;
			const sameCreated = previous.createdAt.getTime() === msg.createdAt.getTime();
			const prevUpdated = previous.updatedAt?.getTime() ?? null;
			const nextUpdated = msg.updatedAt?.getTime() ?? null;
			if (sameRole && sameContent && sameCreated && prevUpdated === nextUpdated) {
				return previous;
			}
			return msg;
		});
		lastMergedRef.current = stabilized;
		return stabilized;
	}, [initialMessages, optimisticNormalized]);

	return (
		<ChatMessagesPanel
			messages={merged.map((msg) => ({ id: msg.id, role: msg.role, content: msg.content }))}
			paddingBottom={paddingBottom}
			className={className}
			loading={loading}
		/>
	);
}

export default ChatMessagesFeed;
