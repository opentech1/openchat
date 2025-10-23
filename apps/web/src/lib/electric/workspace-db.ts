import { createCollection, type Collection } from "@tanstack/db";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { useLiveQuery } from "@tanstack/react-db";
import { z } from "zod";

const ELECTRIC_ENABLED = Boolean(process.env.NEXT_PUBLIC_ELECTRIC_URL);
const SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");

const DEFAULT_WORKSPACE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MESSAGE_TTL_MS = 5 * 60 * 1000;

const WORKSPACE_COLLECTION_TTL_MS = (() => {
	const parsed = Number(process.env.NEXT_PUBLIC_ELECTRIC_WORKSPACE_TTL_MS ?? DEFAULT_WORKSPACE_TTL_MS);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WORKSPACE_TTL_MS;
})();

const MESSAGE_COLLECTION_TTL_MS = (() => {
	const parsed = Number(process.env.NEXT_PUBLIC_ELECTRIC_CHAT_TTL_MS ?? DEFAULT_MESSAGE_TTL_MS);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MESSAGE_TTL_MS;
})();

const MAX_WORKSPACE_COLLECTIONS = (() => {
	const parsed = Number(process.env.NEXT_PUBLIC_ELECTRIC_MAX_WORKSPACES ?? 4);
	if (!Number.isFinite(parsed) || parsed < 0) return 4;
	return Math.floor(parsed);
})();

const MAX_MESSAGE_COLLECTIONS = (() => {
	const parsed = Number(process.env.NEXT_PUBLIC_ELECTRIC_MAX_CHAT_COLLECTIONS ?? 12);
	if (!Number.isFinite(parsed) || parsed < 0) return 12;
	return Math.floor(parsed);
})();

type FetchWithOptionalPreconnect = typeof fetch & {
	preconnect?: (
		...args: Parameters<typeof fetch>
	) => unknown;
};

const fetchWithCredentials = (() => {
	const wrapped = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
		fetch(input, {
			...init,
			credentials: 'include',
		})) as FetchWithOptionalPreconnect;
	const typedFetch = fetch as FetchWithOptionalPreconnect;
	if (typeof typedFetch.preconnect === 'function') {
		wrapped.preconnect = typedFetch.preconnect.bind(typedFetch);
	}
	return wrapped;
})();

const chatSchema = z.object({
	id: z.string(),
	title: z.string().nullable(),
	updated_at: z.string().nullable().optional(),
	last_message_at: z.string().nullable().optional(),
	user_id: z.string(),
});

export type WorkspaceChatRow = z.infer<typeof chatSchema>;

const messageSchema = z.object({
	id: z.string(),
	chat_id: z.string(),
	role: z.string(),
	content: z.string(),
	created_at: z.string().nullable().optional(),
	updated_at: z.string().nullable().optional(),
});

type MessageCollectionEntry = {
	collection: Collection<z.infer<typeof messageSchema>>;
	lastAccessed: number;
};

type WorkspaceCollections = {
	chats: Collection<z.infer<typeof chatSchema>>;
	messages: Map<string, MessageCollectionEntry>;
	lastAccessed: number;
};

const workspaceCollections = new Map<string, WorkspaceCollections>();

function buildShapeUrl(scope: "chats" | "messages") {
	if (!ELECTRIC_ENABLED) return null;
	return `${SERVER_URL}/api/electric/v1/shape?scope=${encodeURIComponent(scope)}`;
}

function createChatsCollection(workspaceId: string, shapeUrl: string) {
	return createCollection({
		id: `chats-${workspaceId}`,
		...electricCollectionOptions({
			schema: chatSchema,
			getKey: (row) => row.id,
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
				fetchClient: fetchWithCredentials,
				onError: () => undefined,
			},
		}),
	});
}

function createMessagesCollection(workspaceId: string, chatId: string, shapeUrl: string) {
	return createCollection({
		id: `messages-${workspaceId}-${chatId}`,
		...electricCollectionOptions({
			schema: messageSchema,
			getKey: (row) => row.id,
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
				fetchClient: fetchWithCredentials,
				onError: () => undefined,
			},
		}),
	});
}

function ensureWorkspaceCollections(workspaceId: string) {
	if (!ELECTRIC_ENABLED) return null;
	const ts = Date.now();
	let entry = workspaceCollections.get(workspaceId);
	if (!entry) {
		const shapeUrl = buildShapeUrl("chats");
		if (!shapeUrl) return null;
		entry = {
			chats: createChatsCollection(workspaceId, shapeUrl),
			messages: new Map(),
			lastAccessed: ts,
		};
		workspaceCollections.set(workspaceId, entry);
	} else {
		entry.lastAccessed = ts;
	}
	pruneWorkspaceCollections(ts);
	return entry;
}

export function useWorkspaceChats(
	workspaceId: string | null | undefined,
	fallback: WorkspaceChatRow[],
) {
	if (typeof window === "undefined") {
		return { enabled: false, isReady: true, status: "idle", data: fallback } as const;
	}
	const ts = Date.now();
	const entry = workspaceId ? ensureWorkspaceCollections(workspaceId) : null;
	if (entry) {
		entry.lastAccessed = ts;
		pruneMessageCollections(entry, ts);
	}
	const live = entry?.chats ? useLiveQuery(entry.chats) : null;
	return {
		enabled: Boolean(entry?.chats),
		isReady: Boolean(live?.isReady),
		status: live?.status ?? "idle",
		data: (live?.isReady && live.data ? live.data : fallback) as WorkspaceChatRow[],
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
	const ts = Date.now();
	const entry = ensureWorkspaceCollections(workspaceId);
	if (!entry) {
		return { enabled: false, isReady: true, status: "idle", data: fallback };
	}
	entry.lastAccessed = ts;
	let messageEntry = entry.messages.get(chatId);
	if (!messageEntry) {
		const shapeUrl = buildShapeUrl("messages");
		if (!shapeUrl) {
			return { enabled: false, isReady: true, status: "idle", data: fallback };
		}
		const collection = createMessagesCollection(workspaceId, chatId, shapeUrl);
		messageEntry = { collection, lastAccessed: ts };
		entry.messages.set(chatId, messageEntry);
	} else {
		messageEntry.lastAccessed = ts;
	}
	pruneMessageCollections(entry, ts);
	const live = useLiveQuery(messageEntry.collection);
	return {
		enabled: true,
		isReady: live.isReady,
		status: live.status,
		data: live.isReady && live.data ? live.data : fallback,
	};
}
function cleanupCollection(collection: Collection<any>) {
	void collection.cleanup().catch(() => undefined);
}

function flushWorkspace(workspaceId: string, entry: WorkspaceCollections) {
	cleanupCollection(entry.chats);
	for (const messageEntry of entry.messages.values()) {
		cleanupCollection(messageEntry.collection);
	}
	entry.messages.clear();
	workspaceCollections.delete(workspaceId);
}

function pruneWorkspaceCollections(ts: number) {
	for (const [workspaceId, entry] of workspaceCollections) {
		if (ts - entry.lastAccessed > WORKSPACE_COLLECTION_TTL_MS) {
			flushWorkspace(workspaceId, entry);
		}
	}
	if (MAX_WORKSPACE_COLLECTIONS > 0 && workspaceCollections.size > MAX_WORKSPACE_COLLECTIONS) {
		const entries = Array.from(workspaceCollections.entries()).sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
		while (workspaceCollections.size > MAX_WORKSPACE_COLLECTIONS && entries.length > 0) {
			const [workspaceId, entry] = entries.shift()!;
			if (!workspaceCollections.has(workspaceId)) continue;
			flushWorkspace(workspaceId, entry);
		}
	}
}

function pruneMessageCollections(entry: WorkspaceCollections, ts: number) {
	for (const [chatId, messageEntry] of entry.messages) {
		if (ts - messageEntry.lastAccessed > MESSAGE_COLLECTION_TTL_MS) {
			cleanupCollection(messageEntry.collection);
			entry.messages.delete(chatId);
		}
	}
	if (MAX_MESSAGE_COLLECTIONS > 0 && entry.messages.size > MAX_MESSAGE_COLLECTIONS) {
		const ordered = Array.from(entry.messages.entries()).sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
		while (entry.messages.size > MAX_MESSAGE_COLLECTIONS && ordered.length > 0) {
			const [chatId, messageEntry] = ordered.shift()!;
			if (!entry.messages.has(chatId)) continue;
			cleanupCollection(messageEntry.collection);
			entry.messages.delete(chatId);
		}
	}
}
