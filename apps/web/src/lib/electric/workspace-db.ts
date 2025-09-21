import { createCollection, type Collection } from "@tanstack/db";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { useLiveQuery } from "@tanstack/react-db";
import { z } from "zod";

const ELECTRIC_ENABLED = Boolean(process.env.NEXT_PUBLIC_ELECTRIC_URL);
const SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");

const chatSchema = z.object({
	id: z.string(),
	title: z.string().nullable(),
	updated_at: z.string().nullable().optional(),
	last_message_at: z.string().nullable().optional(),
	user_id: z.string(),
});

const messageSchema = z.object({
	id: z.string(),
	chat_id: z.string(),
	role: z.string(),
	content: z.string(),
	created_at: z.string().nullable().optional(),
	updated_at: z.string().nullable().optional(),
});

type WorkspaceCollections = {
	chats: Collection<z.infer<typeof chatSchema>>;
	messages: Map<string, Collection<z.infer<typeof messageSchema>>>;
};

const workspaceCollections = new Map<string, WorkspaceCollections>();

function buildShapeUrl(scope: "chats" | "messages") {
	if (!ELECTRIC_ENABLED) return null;
	return `${SERVER_URL}/api/electric/shapes/${scope}`;
}

function createChatsCollection(workspaceId: string, shapeUrl: string) {
	return createCollection({
		id: `chats-${workspaceId}`,
		schema: chatSchema,
		getKey: (row) => row.id,
		...electricCollectionOptions({
			shapeOptions: {
				url: shapeUrl,
				params: {
					table: "chat",
				},
				headers: {
					"x-user-id": workspaceId,
				},
				subscribe: true,
				experimentalLiveSse: true,
				fetchClient: (input, init) =>
					fetch(input, {
						...init,
						credentials: "include",
					}),
				onError: () => undefined,
			},
		}),
	});
}

function createMessagesCollection(workspaceId: string, chatId: string, shapeUrl: string) {
	return createCollection({
		id: `messages-${workspaceId}-${chatId}`,
		schema: messageSchema,
		getKey: (row) => row.id,
		...electricCollectionOptions({
			shapeOptions: {
				url: shapeUrl,
				params: {
					table: "message",
					chatId,
				},
				headers: {
					"x-user-id": workspaceId,
				},
				subscribe: true,
				experimentalLiveSse: true,
				fetchClient: (input, init) =>
					fetch(input, {
						...init,
						credentials: "include",
					}),
				onError: () => undefined,
			},
		}),
	});
}

function ensureWorkspaceCollections(workspaceId: string) {
	if (!ELECTRIC_ENABLED) return null;
	let entry = workspaceCollections.get(workspaceId);
	if (!entry) {
		const shapeUrl = buildShapeUrl("chats");
		if (!shapeUrl) return null;
		entry = {
			chats: createChatsCollection(workspaceId, shapeUrl),
			messages: new Map(),
		};
		workspaceCollections.set(workspaceId, entry);
	}
	return entry;
}

export function useWorkspaceChats(
	workspaceId: string | null | undefined,
	fallback: Array<{ id: string; title: string | null; updatedAt?: string; lastMessageAt?: string }>,
) {
	if (typeof window === "undefined") {
		return { enabled: false, isReady: true, status: "idle", data: fallback } as const;
	}
	const entry = workspaceId ? ensureWorkspaceCollections(workspaceId) : null;
	const live = entry?.chats ? useLiveQuery(entry.chats) : null;
	return {
		enabled: Boolean(entry?.chats),
		isReady: Boolean(live?.isReady),
		status: live?.status ?? "idle",
		data: live?.isReady && live.data ? live.data : fallback,
	};
}

export function useChatMessages(
	workspaceId: string | null | undefined,
	chatId: string | null | undefined,
	fallback: Array<{ id: string; role: string; content: string; createdAt?: string }>,
) {
	if (typeof window === "undefined") {
		return { enabled: false, isReady: true, status: "idle", data: fallback };
	}
	if (!workspaceId || !chatId) {
		return { enabled: false, isReady: true, status: "idle", data: fallback };
	}
	const entry = ensureWorkspaceCollections(workspaceId);
	if (!entry) {
		return { enabled: false, isReady: true, status: "idle", data: fallback };
	}
	let collection = entry.messages.get(chatId);
	if (!collection) {
		const shapeUrl = buildShapeUrl("messages");
		if (!shapeUrl) {
			return { enabled: false, isReady: true, status: "idle", data: fallback };
		}
		collection = createMessagesCollection(workspaceId, chatId, shapeUrl);
		entry.messages.set(chatId, collection);
	}
	const live = useLiveQuery(collection);
	return {
		enabled: true,
		isReady: live.isReady,
		status: live.status,
		data: live.isReady && live.data ? live.data : fallback,
	};
}
