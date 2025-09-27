"use client";

import { useMemo } from "react";
import type { UIMessage } from "ai";

import { ChatMessagesPanel } from "@/components/chat-messages-panel";
import type { NormalizedMessage } from "@/lib/chat-message-utils";
import {
	mergeNormalizedMessages,
	normalizeMessage,
	normalizeUiMessage,
	toElectricMessageRecord,
} from "@/lib/chat-message-utils";
import { useChatMessages } from "@/lib/electric/workspace-db";

type ElectricMessageRecord = {
	id: string;
	role: string;
	content: string;
	created_at?: string | null;
	updated_at?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
};

type ChatMessagesFeedProps = {
	chatId: string;
	workspaceId: string | null;
	initialMessages: NormalizedMessage[];
	optimisticMessages: UIMessage<{ createdAt?: string }>[];
	paddingBottom: number;
	className?: string;
};

function normalizeElectricMessages(rows: ElectricMessageRecord[]): NormalizedMessage[] {
	return rows.map((row) =>
		normalizeMessage({
			id: row.id,
			role: row.role,
			content: row.content,
			created_at: row.created_at ?? row.createdAt,
			updated_at: row.updated_at ?? row.updatedAt,
		}),
	);
}

export function ChatMessagesFeed({
	chatId,
	workspaceId,
	initialMessages,
	optimisticMessages,
	paddingBottom,
	className,
}: ChatMessagesFeedProps) {
	const fallback = useMemo(() => initialMessages.map(toElectricMessageRecord), [initialMessages]);
	const liveMessages = useChatMessages(workspaceId, chatId, fallback);

	const baseMessages = useMemo(() => {
		if (!liveMessages.enabled) return initialMessages;
		const source = liveMessages.data ?? fallback;
		return normalizeElectricMessages(source as ElectricMessageRecord[]);
	}, [fallback, initialMessages, liveMessages.data, liveMessages.enabled]);

	const optimisticNormalized = useMemo(
		() => optimisticMessages.map(normalizeUiMessage),
		[optimisticMessages],
	);

	const merged = useMemo(() => {
		return mergeNormalizedMessages(baseMessages, optimisticNormalized);
	}, [baseMessages, optimisticNormalized]);

	return (
		<ChatMessagesPanel
			messages={merged.map((msg) => ({ id: msg.id, role: msg.role, content: msg.content, createdAt: msg.createdAt }))}
			paddingBottom={paddingBottom}
			className={className}
		/>
	);
}

export default ChatMessagesFeed;
