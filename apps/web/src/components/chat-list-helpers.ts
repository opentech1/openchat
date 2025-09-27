import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useWorkspaceChats, type WorkspaceChatRow } from "@/lib/electric/workspace-db";
import { connect, subscribe, type Envelope } from "@/lib/sync";

export type ChatListItem = {
	id: string;
	title: string | null;
	updatedAt?: string | Date;
	lastMessageAt?: string | Date | null;
};

export function normalizeChat(chat: ChatListItem): ChatListItem {
	return {
		...chat,
		updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : undefined,
		lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt) : null,
	};
}

function dateToIso(value: string | Date | null | undefined) {
	if (!value) return undefined;
	const date = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return undefined;
	return date.toISOString();
}

export function sortChats(list: ChatListItem[]) {
	const copy = list.slice();
	copy.sort((a, b) => {
		const aLast = (a.lastMessageAt ? new Date(a.lastMessageAt) : a.updatedAt ? new Date(a.updatedAt) : new Date(0)).getTime();
		const bLast = (b.lastMessageAt ? new Date(b.lastMessageAt) : b.updatedAt ? new Date(b.updatedAt) : new Date(0)).getTime();
		if (bLast !== aLast) return bLast - aLast;
		const aUp = (a.updatedAt ? new Date(a.updatedAt) : new Date(0)).getTime();
		const bUp = (b.updatedAt ? new Date(b.updatedAt) : new Date(0)).getTime();
		return bUp - aUp;
	});
	return copy;
}

export function dedupeChats(list: ChatListItem[]) {
	const map = new Map<string, ChatListItem>();
	for (const chat of list) {
		map.set(chat.id, chat);
	}
	return sortChats(Array.from(map.values()));
}

export function mapLiveChat(row: WorkspaceChatRow): ChatListItem {
	return {
		id: row.id,
		title: row.title,
		updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
		lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
	};
}

type SerializedChat = {
	id: string;
	title: string | null;
	user_id: string;
	updated_at: string | null;
	last_message_at: string | null;
};

function serializeChats(initial: ChatListItem[], userId: string): SerializedChat[] {
	return initial.map((chat) => ({
		id: chat.id,
		title: chat.title,
		user_id: userId,
		updated_at: dateToIso(chat.updatedAt) ?? null,
		last_message_at: dateToIso(chat.lastMessageAt) ?? null,
	}));
}

type UseSyncedChatListArgs = {
	currentUserId: string;
	initialChats?: ChatListItem[];
};

export type UseSyncedChatListResult = {
	chats: ChatListItem[];
	fallbackChats: ChatListItem[];
	optimisticChats: ChatListItem[];
	isLoading: boolean;
	setFallbackChats: Dispatch<SetStateAction<ChatListItem[]>>;
	setOptimisticChats: Dispatch<SetStateAction<ChatListItem[]>>;
};

export function useSyncedChatList({ currentUserId, initialChats = [] }: UseSyncedChatListArgs): UseSyncedChatListResult {
	const normalizedInitial = useMemo(() => initialChats.map(normalizeChat), [initialChats]);
	const [fallbackChats, setFallbackChats] = useState<ChatListItem[]>(normalizedInitial);
	const [optimisticChats, setOptimisticChats] = useState<ChatListItem[]>([]);

	useEffect(() => {
		setFallbackChats(dedupeChats(normalizedInitial));
	}, [normalizedInitial]);

	const serializedFallback = useMemo(() => serializeChats(normalizedInitial, currentUserId), [normalizedInitial, currentUserId]);

	const chatQuery = useWorkspaceChats(currentUserId, serializedFallback);
	const electricChats = useMemo(() => {
		if (!currentUserId) return null;
		if (!chatQuery.enabled) return null;
		const rows = chatQuery.data?.map(mapLiveChat);
		if (!rows) return null;
		return sortChats(rows);
	}, [chatQuery.data, chatQuery.enabled, currentUserId]);

	useEffect(() => {
		if (electricChats) setFallbackChats(dedupeChats(electricChats));
	}, [electricChats]);

	useEffect(() => {
		if (!currentUserId) return;
		void connect();
		const topic = `chats:index:${currentUserId}`;
		const handler = (evt: Envelope) => {
			if (evt.type === "chats.index.add") {
				const d = evt.data as {
					chatId: string;
					title?: string;
					updatedAt?: string | Date;
					lastMessageAt?: string | Date;
				};
				setFallbackChats((prev) => {
					if (prev.some((chat) => chat.id === d.chatId)) return prev;
					const next = prev.concat([
						{
							id: d.chatId,
							title: d.title ?? "New Chat",
							updatedAt: d.updatedAt ? new Date(d.updatedAt) : undefined,
							lastMessageAt: d.lastMessageAt ? new Date(d.lastMessageAt) : null,
						},
					]);
					return dedupeChats(next);
				});
			} else if (evt.type === "chats.index.update") {
				const d = evt.data as {
					chatId: string;
					title?: string | null;
					updatedAt?: string | Date | null;
					lastMessageAt?: string | Date | null;
				};
				setFallbackChats((prev) => {
					const next = prev.map((chat) =>
						chat.id === d.chatId
							? {
								...chat,
								title: d.title ?? chat.title,
								updatedAt: d.updatedAt != null ? new Date(d.updatedAt) : chat.updatedAt,
								lastMessageAt: d.lastMessageAt != null ? new Date(d.lastMessageAt) : chat.lastMessageAt,
							}
							: chat,
					);
					return dedupeChats(next);
				});
			} else if (evt.type === "chats.index.remove") {
				const d = evt.data as { chatId: string };
				setFallbackChats((prev) => prev.filter((chat) => chat.id !== d.chatId));
			}
		};
		const unsubscribe = subscribe(topic, handler);
		return () => {
			unsubscribe();
		};
	}, [currentUserId]);

	const baseChats = fallbackChats;
	const isLoading = chatQuery.enabled && !chatQuery.isReady && fallbackChats.length === 0;

	const chats = useMemo(() => {
		if (optimisticChats.length === 0) return baseChats;
		const baseIds = new Set(baseChats.map((chat) => chat.id));
		const supplemental = optimisticChats.filter((chat) => !baseIds.has(chat.id));
		return sortChats(baseChats.concat(supplemental));
	}, [baseChats, optimisticChats]);

	return {
		chats,
		fallbackChats,
		optimisticChats,
		isLoading,
		setFallbackChats,
		setOptimisticChats,
	};
}
