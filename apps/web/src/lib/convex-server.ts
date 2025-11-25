import { ConvexHttpClient } from "convex/browser";
import type { Doc, Id } from "@server/convex/_generated/dataModel";
import { api } from "@server/convex/_generated/api";

export type SessionUser = {
	id: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

let cachedClient: ConvexHttpClient | null = null;

// PERFORMANCE FIX: Request-level cache for ensureConvexUser calls
// Prevents multiple database lookups for the same user within a single request
// Cache is cleared after 5 seconds to prevent stale data
type UserCacheEntry = {
	userId: Id<"users">;
	timestamp: number;
};
const userCache = new Map<string, UserCacheEntry>();
const CACHE_TTL_MS = 5000; // 5 seconds - short TTL to keep data fresh

async function getConvexUrl() {
	const { getServerEnv } = await import("./env");
	const env = getServerEnv();
	return env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL;
}

async function getClient() {
	if (!cachedClient) {
		const url = await getConvexUrl();
		if (!url) {
			throw new Error("CONVEX_URL is not configured. Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL.");
		}
		cachedClient = new ConvexHttpClient(url);
	}
	return cachedClient;
}

export async function ensureConvexUser(sessionUser: SessionUser) {
	// PERFORMANCE FIX: Check cache first to avoid redundant database calls
	const now = Date.now();
	const cacheKey = sessionUser.id;
	const cached = userCache.get(cacheKey);

	if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
		return cached.userId;
	}

	// Clean up expired cache entries periodically (when cache size > 100)
	if (userCache.size > 100) {
		for (const [key, entry] of userCache.entries()) {
			if (now - entry.timestamp >= CACHE_TTL_MS) {
				userCache.delete(key);
			}
		}
	}

	const client = await getClient();
	const result = await client.mutation(api.users.ensure, {
		externalId: sessionUser.id,
		email: sessionUser.email ?? undefined,
		name: sessionUser.name ?? undefined,
		avatarUrl: sessionUser.image ?? undefined,
	});

	const userId = result.userId as Id<"users">;

	// Store in cache for future requests
	userCache.set(cacheKey, {
		userId,
		timestamp: now,
	});

	return userId;
}

export async function getUserById(userId: Id<"users">) {
	const client = await getClient();
	const user = await client.query(api.users.getById, { userId });
	return user;
}

export async function listChats(userId: Id<"users">, cursor?: string, limit?: number) {
	const client = await getClient();
	return client.query(api.chats.list, { userId, cursor, limit });
}

export async function createChatForUser(userId: Id<"users">, title: string) {
	const client = await getClient();
	const { chatId } = await client.mutation(api.chats.create, { userId, title });
	const chat = await client.query(api.chats.get, { chatId, userId });
	if (!chat) throw new Error("Chat not found after creation");
	return chat;
}

export async function deleteChatForUser(userId: Id<"users">, chatId: Id<"chats">) {
	const client = await getClient();
	return client.mutation(api.chats.remove, { userId, chatId });
}

export async function listMessagesForChat(userId: Id<"users">, chatId: Id<"chats">) {
	const client = await getClient();
	return client.query(api.messages.list, { userId, chatId });
}

export async function sendMessagePair(args: {
	userId: Id<"users">;
	chatId: Id<"chats">;
	user: { content: string; createdAt?: number; clientMessageId?: string };
	assistant?: { content: string; createdAt?: number; clientMessageId?: string };
}) {
	const client = await getClient();
	return client.mutation(api.messages.send, {
		userId: args.userId,
		chatId: args.chatId,
		userMessage: {
			content: args.user.content,
			createdAt: args.user.createdAt,
			clientMessageId: args.user.clientMessageId,
		},
		assistantMessage: args.assistant
			? {
					content: args.assistant.content,
					createdAt: args.assistant.createdAt,
					clientMessageId: args.assistant.clientMessageId,
			  }
			: undefined,
	});
}

export async function streamUpsertMessage(args: {
	userId: Id<"users">;
	chatId: Id<"chats">;
	messageId?: Id<"messages">;
	clientMessageId?: string;
	role: "user" | "assistant";
	content: string;
	reasoning?: string;
	thinkingTimeMs?: number;
	status?: "streaming" | "completed";
	createdAt?: number;
	attachments?: Array<{
		storageId: Id<"_storage">;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
	}>;
}) {
	const client = await getClient();
	return client.mutation(api.messages.streamUpsert, {
		userId: args.userId,
		chatId: args.chatId,
		messageId: args.messageId,
		clientMessageId: args.clientMessageId,
		role: args.role,
		content: args.content,
		reasoning: args.reasoning,
		thinkingTimeMs: args.thinkingTimeMs,
		status: args.status,
		createdAt: args.createdAt,
		attachments: args.attachments,
	});
}

/**
 * PERFORMANCE: Combined helper that gets user context and ensures Convex user in one call
 * This eliminates redundant getUserContext calls in API routes
 * @returns Tuple of [session context, convex user ID]
 */
export async function getConvexUserFromSession(): Promise<[SessionUser, Id<"users">]> {
	const { getUserContext } = await import("./auth-server");
	const session = await getUserContext();
	const sessionUser: SessionUser = {
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	};
	const convexUserId = await ensureConvexUser(sessionUser);
	return [sessionUser, convexUserId];
}

/**
 * Get Convex user from Request object (for API routes)
 *
 * This reads cookies directly from the request headers instead of using
 * next/headers cookies() which doesn't work in some environments.
 *
 * Returns null if not authenticated. API routes should return 401.
 */
export async function getConvexUserFromRequest(request: Request): Promise<[SessionUser, Id<"users">] | null> {
	const { getUserContextFromRequest } = await import("./auth-server");
	const session = await getUserContextFromRequest(request);

	if (!session) {
		return null;
	}

	const sessionUser: SessionUser = {
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	};
	const convexUserId = await ensureConvexUser(sessionUser);
	return [sessionUser, convexUserId];
}

/**
 * Get file URL from Convex storage
 */
export async function getFileUrl(storageId: Id<"_storage">, userId: Id<"users">) {
	const client = await getClient();
	return client.query(api.files.getFileUrl, { storageId, userId });
}

export type ChatDoc = Doc<"chats">;
export type MessageDoc = Doc<"messages">;
