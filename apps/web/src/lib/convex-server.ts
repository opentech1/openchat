import { ConvexHttpClient } from "convex/browser";
import type { Doc, Id } from "@server/convex/_generated/dataModel";
import { api } from "@server/convex/_generated/api";
import { userCache, isRedisCacheAvailable, invalidateUserCache } from "./cache";

export type SessionUser = {
	id: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

let cachedClient: ConvexHttpClient | null = null;

// PERFORMANCE FIX: In-memory fallback cache for when Redis is unavailable
// Used as secondary cache when Redis is down or not configured
// Short TTL (5 seconds) to keep data fresh on single instance
type UserMemoryCacheEntry = {
	userId: Id<"users">;
	timestamp: number;
};
const userMemoryCache = new Map<string, UserMemoryCacheEntry>();
const MEMORY_CACHE_TTL_MS = 5000; // 5 seconds - short TTL for in-memory fallback

// Redis cache TTL (longer since it's distributed)
const REDIS_CACHE_TTL_SECONDS = 60; // 60 seconds

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
	const now = Date.now();
	const cacheKey = sessionUser.id;

	// 1. Try Redis cache first (if available)
	if (isRedisCacheAvailable()) {
		try {
			const redisCached = await userCache.get(cacheKey);
			// Type safety: validate _id exists and is a string before casting
			if (redisCached && redisCached._id && typeof redisCached._id === "string") {
				console.debug(`[cache] Redis cache hit for user ${cacheKey}`);
				return redisCached._id as Id<"users">;
			}
			console.debug(`[cache] Redis cache miss for user ${cacheKey}`);
		} catch (error) {
			console.warn("[cache] Redis cache check failed, falling back to memory:",
				error instanceof Error ? error.message : String(error));
		}
	}

	// 2. Fallback to in-memory cache
	const memoryCached = userMemoryCache.get(cacheKey);
	if (memoryCached && now - memoryCached.timestamp < MEMORY_CACHE_TTL_MS) {
		console.debug(`[cache] Memory cache hit for user ${cacheKey}`);
		return memoryCached.userId;
	}
	console.debug(`[cache] Memory cache miss for user ${cacheKey}`);

	// Clean up expired in-memory cache entries periodically (when cache size > 100)
	if (userMemoryCache.size > 100) {
		for (const [key, entry] of userMemoryCache.entries()) {
			if (now - entry.timestamp >= MEMORY_CACHE_TTL_MS) {
				userMemoryCache.delete(key);
			}
		}
	}

	// 3. Call Convex mutation to get/create user
	const client = await getClient();
	const result = await client.mutation(api.users.ensure, {
		externalId: sessionUser.id,
		email: sessionUser.email ?? undefined,
		name: sessionUser.name ?? undefined,
		avatarUrl: sessionUser.image ?? undefined,
	});

	const userId = result.userId as Id<"users">;

	// 4. Update both caches
	// Redis cache (60 second TTL)
	if (isRedisCacheAvailable()) {
		try {
			await userCache.set(
				cacheKey,
				{
					_id: userId,
					externalId: sessionUser.id,
					email: sessionUser.email ?? undefined,
					name: sessionUser.name ?? undefined,
					avatarUrl: sessionUser.image ?? undefined,
					cachedAt: now,
				},
				REDIS_CACHE_TTL_SECONDS,
			);
			console.debug(`[cache] Stored user ${cacheKey} in Redis cache (TTL: ${REDIS_CACHE_TTL_SECONDS}s)`);
		} catch (error) {
			console.warn("[cache] Failed to store user in Redis cache:",
				error instanceof Error ? error.message : String(error));
		}
	}

	// In-memory cache (5 second TTL)
	userMemoryCache.set(cacheKey, {
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

// Re-export cache invalidation for use by other modules
export { invalidateUserCache };
