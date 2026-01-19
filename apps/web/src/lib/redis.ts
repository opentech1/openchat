/**
 * Redis client for real-time streaming
 * 
 * Uses Redis Streams for durable, resumable chat token streaming.
 * Works with any Redis (self-hosted, Upstash, etc.)
 */

import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let isConnected = false;
let connectionPromise: Promise<void> | null = null;

const REDIS_URL = process.env.REDIS_URL;

export function getRedisClient(): RedisClientType | null {
	if (!REDIS_URL) {
		return null;
	}

	if (!redisClient) {
		redisClient = createClient({ url: REDIS_URL });
		redisClient.on("error", (err) => {
			console.error("[Redis] Error:", err);
			isConnected = false;
		});
		redisClient.on("connect", () => {
			console.log("[Redis] Connected");
			isConnected = true;
		});
		redisClient.on("disconnect", () => {
			console.log("[Redis] Disconnected");
			isConnected = false;
		});
		connectionPromise = redisClient.connect().then(() => {}).catch((err) => {
			console.error("[Redis] Connection failed:", err);
			isConnected = false;
		});
	}

	return redisClient;
}

export async function ensureRedisConnected(): Promise<boolean> {
	if (!REDIS_URL) return false;
	getRedisClient();
	if (connectionPromise) {
		await connectionPromise;
	}
	return isConnected;
}

export function isRedisAvailable(): boolean {
	return !!REDIS_URL && isConnected;
}

const keys = {
	stream: (chatId: string) => `chat:${chatId}:stream`,
	meta: (chatId: string) => `chat:${chatId}:meta`,
	typing: (chatId: string, userId: string) => `chat:${chatId}:typing:${userId}`,
	presence: (userId: string) => `presence:${userId}`,
	unread: (userId: string) => `user:${userId}:unread`,
};

export interface StreamToken {
	id: string;
	text: string;
	type: "text" | "reasoning" | "done" | "error";
	timestamp: number;
}

export interface StreamMeta {
	status: "streaming" | "completed" | "error";
	chatId: string;
	userId: string;
	messageId: string;
	startedAt: number;
	completedAt?: number;
	error?: string;
}

async function getConnectedClient(): Promise<RedisClientType | null> {
	const client = getRedisClient();
	if (!client) return null;
	if (connectionPromise) {
		await connectionPromise;
	}
	if (!isConnected) return null;
	return client;
}

export async function initStream(
	chatId: string,
	userId: string,
	messageId: string,
): Promise<boolean> {
	const client = await getConnectedClient();
	if (!client) return false;

	const meta: StreamMeta = {
		status: "streaming",
		chatId,
		userId,
		messageId,
		startedAt: Date.now(),
	};

	await client.set(keys.meta(chatId), JSON.stringify(meta), { EX: 3600 });
	console.log("[Redis] Stream initialized for chat:", chatId);
	return true;
}

export async function appendToken(
	chatId: string,
	text: string,
	type: StreamToken["type"] = "text",
): Promise<string | null> {
	const client = await getConnectedClient();
	if (!client) return null;

	const streamKey = keys.stream(chatId);
	const entryId = await client.xAdd(streamKey, "*", {
		text,
		type,
		ts: Date.now().toString(),
	});

	await client.expire(streamKey, 3600);

	return entryId;
}

export async function completeStream(chatId: string): Promise<void> {
	const client = await getConnectedClient();
	if (!client) return;

	await appendToken(chatId, "", "done");

	const metaKey = keys.meta(chatId);
	const metaStr = await client.get(metaKey);
	if (metaStr) {
		const meta: StreamMeta = JSON.parse(metaStr);
		meta.status = "completed";
		meta.completedAt = Date.now();
		await client.set(metaKey, JSON.stringify(meta), { EX: 3600 });
	}
	console.log("[Redis] Stream completed for chat:", chatId);
}

export async function errorStream(chatId: string, error: string): Promise<void> {
	const client = await getConnectedClient();
	if (!client) return;

	await appendToken(chatId, error, "error");

	const metaKey = keys.meta(chatId);
	const metaStr = await client.get(metaKey);
	if (metaStr) {
		const meta: StreamMeta = JSON.parse(metaStr);
		meta.status = "error";
		meta.error = error;
		meta.completedAt = Date.now();
		await client.set(metaKey, JSON.stringify(meta), { EX: 600 });
	}
}

export async function readStream(
	chatId: string,
	lastId: string = "0",
): Promise<StreamToken[]> {
	const client = await getConnectedClient();
	if (!client) return [];

	const streamKey = keys.stream(chatId);
	const entries = await client.xRange(streamKey, lastId === "0" ? "-" : `(${lastId}`, "+");

	return entries.map((entry) => ({
		id: entry.id,
		text: entry.message.text || "",
		type: (entry.message.type as StreamToken["type"]) || "text",
		timestamp: parseInt(entry.message.ts || "0", 10),
	}));
}

export async function getStreamMeta(chatId: string): Promise<StreamMeta | null> {
	const client = await getConnectedClient();
	if (!client) return null;

	const metaStr = await client.get(keys.meta(chatId));
	if (!metaStr) return null;

	return JSON.parse(metaStr);
}

export async function hasActiveStream(chatId: string): Promise<boolean> {
	const meta = await getStreamMeta(chatId);
	return meta?.status === "streaming";
}

export async function setTyping(
	chatId: string,
	userId: string,
	isTyping: boolean,
): Promise<void> {
	const client = await getConnectedClient();
	if (!client) return;

	const key = keys.typing(chatId, userId);
	if (isTyping) {
		await client.set(key, "1", { EX: 3 });
	} else {
		await client.del(key);
	}
}

export async function getTypingUsers(chatId: string): Promise<string[]> {
	const client = await getConnectedClient();
	if (!client) return [];

	const pattern = `chat:${chatId}:typing:*`;
	const foundKeys: string[] = [];
	for await (const keys of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
		if (Array.isArray(keys)) {
			foundKeys.push(...keys);
		} else {
			foundKeys.push(keys);
		}
	}

	return foundKeys.map((key) => key.split(":").pop() || "");
}

export async function updatePresence(userId: string): Promise<void> {
	const client = await getConnectedClient();
	if (!client) return;

	await client.set(keys.presence(userId), Date.now().toString(), { EX: 60 });
}

export async function isUserOnline(userId: string): Promise<boolean> {
	const client = await getConnectedClient();
	if (!client) return false;

	const lastSeen = await client.get(keys.presence(userId));
	if (!lastSeen) return false;

	return Date.now() - parseInt(lastSeen, 10) < 60000;
}

export async function incrementUnread(userId: string, chatId: string): Promise<void> {
	const client = await getConnectedClient();
	if (!client) return;

	await client.hIncrBy(keys.unread(userId), chatId, 1);
}

export async function clearUnread(userId: string, chatId: string): Promise<void> {
	const client = await getConnectedClient();
	if (!client) return;

	await client.hDel(keys.unread(userId), chatId);
}

export async function getUnreadCounts(userId: string): Promise<Record<string, number>> {
	const client = await getConnectedClient();
	if (!client) return {};

	const counts = await client.hGetAll(keys.unread(userId));
	const result: Record<string, number> = {};

	for (const [chatId, count] of Object.entries(counts)) {
		result[chatId] = parseInt(count, 10);
	}

	return result;
}

export const redis = {
	getClient: getRedisClient,
	isAvailable: isRedisAvailable,
	ensureConnected: ensureRedisConnected,
	stream: {
		init: initStream,
		append: appendToken,
		complete: completeStream,
		error: errorStream,
		read: readStream,
		getMeta: getStreamMeta,
		hasActive: hasActiveStream,
	},
	typing: {
		set: setTyping,
		getUsers: getTypingUsers,
	},
	presence: {
		update: updatePresence,
		isOnline: isUserOnline,
	},
	unread: {
		increment: incrementUnread,
		clear: clearUnread,
		getAll: getUnreadCounts,
	},
};
