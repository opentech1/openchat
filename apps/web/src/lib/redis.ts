/**
 * Upstash Redis client and utilities for T3Chat-style transient streaming
 *
 * This module provides Redis-based token streaming for LLM responses.
 * Tokens are stored transiently in Redis during streaming and written
 * to Convex in a single operation upon completion.
 *
 * ARCHITECTURE:
 * 1. Client initiates stream request -> Server starts LLM call
 * 2. Server writes tokens to Redis stream as they arrive
 * 3. Client polls Redis for new tokens (or uses SSE relay)
 * 4. On completion: single write to Convex with full message
 * 5. Redis stream auto-expires after TTL
 *
 * BENEFITS:
 * - Reduces Convex writes from O(tokens) to O(1) per message
 * - Enables reconnection/restoration via restoration IDs
 * - Handles browser refreshes gracefully
 * - Scales horizontally (stateless server instances)
 *
 * UPSTASH REDIS STREAMS:
 * - Uses Redis Streams (XADD/XREAD) for ordered token delivery
 * - Each entry has: delta (token text), ts (timestamp)
 * - Cursor-based reading enables resumption from any point
 * - Auto-expiry prevents unbounded memory growth
 *
 * @see rate-limit-redis.ts for rate limiting with same Redis instance
 */

import type { Redis as UpstashRedisType } from "@upstash/redis";

// Lazy load Upstash Redis to avoid import errors when not installed
let UpstashRedis: typeof import("@upstash/redis").Redis;
let redisClient: UpstashRedisType | null = null;
let initPromise: Promise<UpstashRedisType> | null = null;

/**
 * Configuration for Redis client
 */
export interface RedisConfig {
	url?: string;
	token?: string;
}

/**
 * Stream entry structure
 */
export interface StreamEntry {
	id: string;
	delta: string;
	ts: number;
}

/**
 * Stream read result
 */
export interface StreamReadResult {
	entries: StreamEntry[];
	lastCursor: string;
	hasMore: boolean;
}

/**
 * Stream metadata
 */
export interface StreamMetadata {
	status: "streaming" | "completed" | "error";
	totalTokens?: number;
	finalContent?: string;
	error?: string;
	completedAt?: number;
}

/**
 * Load and initialize Upstash Redis client
 */
async function loadUpstashRedis(): Promise<typeof import("@upstash/redis").Redis> {
	if (!UpstashRedis) {
		try {
			const upstashModule = await import("@upstash/redis");
			UpstashRedis = upstashModule.Redis;
		} catch (_error) {
			throw new Error(
				"@upstash/redis package not found. Install it with: bun add @upstash/redis\n" +
					"Or remove UPSTASH_REDIS_REST_URL from environment to disable Redis streaming.",
			);
		}
	}
	return UpstashRedis;
}

/**
 * Get or create Redis client singleton
 */
async function getRedisClient(config?: RedisConfig): Promise<UpstashRedisType> {
	if (redisClient) {
		return redisClient;
	}

	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		const RedisClass = await loadUpstashRedis();
		const url = config?.url || process.env.UPSTASH_REDIS_REST_URL;
		const token = config?.token || process.env.UPSTASH_REDIS_REST_TOKEN;

		if (!url || !token) {
			throw new Error(
				"Missing Upstash Redis credentials. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.\n" +
					"Get credentials from: https://console.upstash.com/redis",
			);
		}

		redisClient = new RedisClass({
			url,
			token,
			retry: {
				retries: 3,
				backoff: (retryCount: number) => Math.min(50 * Math.pow(2, retryCount), 2000),
			},
		});

		return redisClient;
	})();

	return initPromise;
}

/**
 * Create a lazy Redis client proxy
 * Returns an object that initializes Redis only when first used
 */
export function createRedisClient(config?: RedisConfig) {
	return {
		async get(): Promise<UpstashRedisType> {
			return getRedisClient(config);
		},
		isConfigured(): boolean {
			const url = config?.url || process.env.UPSTASH_REDIS_REST_URL;
			const token = config?.token || process.env.UPSTASH_REDIS_REST_TOKEN;
			return Boolean(url && token);
		},
	};
}

/**
 * Default Redis client using environment variables
 */
export const redis = createRedisClient();

// Key prefixes for namespacing
const KEY_PREFIX = {
	stream: "stream:",
	meta: "meta:",
	restoration: "restoration:",
} as const;

/**
 * Stream operations for token streaming
 *
 * Redis Streams provide ordered, durable message delivery with cursor-based
 * reading. Each token is added with XADD and clients read with XREAD.
 */
export const streamOps = {
	/**
	 * Generate a unique stream ID
	 */
	generateStreamId: (): string => {
		const timestamp = Date.now().toString(36);
		const random = Math.random().toString(36).substring(2, 10);
		return `${timestamp}-${random}`;
	},

	/**
	 * Add token to stream
	 *
	 * @param streamId - Unique stream identifier
	 * @param token - Token text to append
	 * @returns Redis stream entry ID
	 */
	appendToken: async (streamId: string, token: string): Promise<string> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.stream}${streamId}`;

		// XADD with * generates auto ID (timestamp-sequence)
		const entryId = await client.xadd(key, "*", {
			delta: token,
			ts: Date.now().toString(),
		});

		return entryId ?? "";
	},

	/**
	 * Append multiple tokens in a batch (pipeline)
	 *
	 * @param streamId - Unique stream identifier
	 * @param tokens - Array of tokens to append
	 */
	appendTokenBatch: async (streamId: string, tokens: string[]): Promise<void> => {
		if (tokens.length === 0) return;

		const client = await redis.get();
		const key = `${KEY_PREFIX.stream}${streamId}`;
		const now = Date.now();

		// Use pipeline for batch writes
		const pipeline = client.pipeline();
		for (let i = 0; i < tokens.length; i++) {
			pipeline.xadd(key, "*", {
				delta: tokens[i],
				ts: (now + i).toString(), // Ensure ordering
			});
		}
		await pipeline.exec();
	},

	/**
	 * Read tokens from cursor position
	 *
	 * @param streamId - Unique stream identifier
	 * @param cursor - Last read cursor (default "0-0" for start)
	 * @param count - Maximum entries to read (default 100)
	 * @returns Stream entries and new cursor
	 */
	readFromCursor: async (
		streamId: string,
		cursor: string = "0-0",
		count: number = 100,
	): Promise<StreamReadResult> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.stream}${streamId}`;

		// XREAD to get entries after the cursor
		// Upstash Redis xread expects: (key, id, options?)
		const result = await client.xread(key, cursor, { count });

		if (!result || result.length === 0 || !result[0]) {
			return {
				entries: [],
				lastCursor: cursor,
				hasMore: false,
			};
		}

		// Result format: [streamName, entries[]]
		const streamData = result[0] as [string, Array<[string, Record<string, string>]>];
		const rawEntries = streamData[1] ?? [];
		const entries: StreamEntry[] = rawEntries.map((entry) => {
			const [id, fields] = entry;
			return {
				id,
				delta: fields.delta || "",
				ts: parseInt(fields.ts || "0", 10),
			};
		});

		const lastEntry = entries[entries.length - 1];
		return {
			entries,
			lastCursor: lastEntry?.id || cursor,
			hasMore: entries.length >= count,
		};
	},

	/**
	 * Read all tokens from stream (for restoration)
	 *
	 * @param streamId - Unique stream identifier
	 * @returns All stream entries
	 */
	readAll: async (streamId: string): Promise<StreamEntry[]> => {
		const allEntries: StreamEntry[] = [];
		let cursor = "0-0";
		let hasMore = true;

		while (hasMore) {
			const result = await streamOps.readFromCursor(streamId, cursor, 1000);
			allEntries.push(...result.entries);
			cursor = result.lastCursor;
			hasMore = result.hasMore;
		}

		return allEntries;
	},

	/**
	 * Get stream length
	 *
	 * @param streamId - Unique stream identifier
	 * @returns Number of entries in stream
	 */
	getLength: async (streamId: string): Promise<number> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.stream}${streamId}`;
		return await client.xlen(key);
	},

	/**
	 * Set stream metadata
	 *
	 * @param streamId - Unique stream identifier
	 * @param metadata - Stream metadata
	 * @param ttlSeconds - TTL for metadata (default 1 hour)
	 */
	setMetadata: async (
		streamId: string,
		metadata: StreamMetadata,
		ttlSeconds: number = 3600,
	): Promise<void> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.meta}${streamId}`;
		await client.set(key, JSON.stringify(metadata), { ex: ttlSeconds });
	},

	/**
	 * Get stream metadata
	 *
	 * @param streamId - Unique stream identifier
	 * @returns Stream metadata or null
	 */
	getMetadata: async (streamId: string): Promise<StreamMetadata | null> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.meta}${streamId}`;
		const data = await client.get<string>(key);
		if (!data) return null;
		try {
			return JSON.parse(data) as StreamMetadata;
		} catch {
			return null;
		}
	},

	/**
	 * Complete stream (set TTL for cleanup)
	 *
	 * Call this when streaming is complete. Sets TTL to allow clients
	 * to catch up before data is deleted.
	 *
	 * @param streamId - Unique stream identifier
	 * @param ttlSeconds - Time to live (default 1 hour)
	 */
	completeStream: async (
		streamId: string,
		ttlSeconds: number = 3600,
	): Promise<void> => {
		const client = await redis.get();
		const streamKey = `${KEY_PREFIX.stream}${streamId}`;
		const metaKey = `${KEY_PREFIX.meta}${streamId}`;

		const pipeline = client.pipeline();
		pipeline.expire(streamKey, ttlSeconds);
		pipeline.expire(metaKey, ttlSeconds);
		await pipeline.exec();
	},

	/**
	 * Delete stream immediately
	 *
	 * Use for cleanup or error handling.
	 *
	 * @param streamId - Unique stream identifier
	 */
	deleteStream: async (streamId: string): Promise<void> => {
		const client = await redis.get();
		const streamKey = `${KEY_PREFIX.stream}${streamId}`;
		const metaKey = `${KEY_PREFIX.meta}${streamId}`;

		await client.del(streamKey, metaKey);
	},

	/**
	 * Check if stream exists
	 *
	 * @param streamId - Unique stream identifier
	 * @returns True if stream exists
	 */
	exists: async (streamId: string): Promise<boolean> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.stream}${streamId}`;
		const exists = await client.exists(key);
		return exists > 0;
	},
};

/**
 * Restoration ID utilities for reconnection support
 *
 * Restoration IDs map user-facing IDs (e.g., message IDs) to internal
 * stream IDs, enabling clients to reconnect and resume streaming.
 */
export const restorationOps = {
	/**
	 * Store restoration mapping
	 *
	 * @param restorationId - User-facing restoration ID (e.g., message ID)
	 * @param streamId - Internal stream ID
	 * @param ttlSeconds - Time to live (default 1 hour)
	 */
	setRestoration: async (
		restorationId: string,
		streamId: string,
		ttlSeconds: number = 3600,
	): Promise<void> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.restoration}${restorationId}`;
		await client.set(key, streamId, { ex: ttlSeconds });
	},

	/**
	 * Get stream ID from restoration ID
	 *
	 * @param restorationId - User-facing restoration ID
	 * @returns Stream ID or null if not found
	 */
	getRestoration: async (restorationId: string): Promise<string | null> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.restoration}${restorationId}`;
		return await client.get<string>(key);
	},

	/**
	 * Delete restoration mapping
	 *
	 * @param restorationId - User-facing restoration ID
	 */
	deleteRestoration: async (restorationId: string): Promise<void> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.restoration}${restorationId}`;
		await client.del(key);
	},

	/**
	 * Extend restoration TTL
	 *
	 * @param restorationId - User-facing restoration ID
	 * @param ttlSeconds - New TTL in seconds
	 * @returns True if extended, false if key doesn't exist
	 */
	extendRestoration: async (
		restorationId: string,
		ttlSeconds: number = 3600,
	): Promise<boolean> => {
		const client = await redis.get();
		const key = `${KEY_PREFIX.restoration}${restorationId}`;
		const result = await client.expire(key, ttlSeconds);
		return result === 1;
	},
};

/**
 * Combined operations for common streaming workflows
 */
export const streamingWorkflow = {
	/**
	 * Initialize a new stream with restoration ID
	 *
	 * @param restorationId - User-facing restoration ID (e.g., message ID)
	 * @param ttlSeconds - Time to live (default 1 hour)
	 * @returns Stream ID for internal use
	 */
	initializeStream: async (
		restorationId: string,
		ttlSeconds: number = 3600,
	): Promise<string> => {
		const streamId = streamOps.generateStreamId();

		// Set up restoration mapping and initial metadata
		await Promise.all([
			restorationOps.setRestoration(restorationId, streamId, ttlSeconds),
			streamOps.setMetadata(streamId, { status: "streaming" }, ttlSeconds),
		]);

		return streamId;
	},

	/**
	 * Finalize stream with completed content
	 *
	 * @param streamId - Internal stream ID
	 * @param finalContent - Complete message content
	 * @param totalTokens - Total token count
	 * @param ttlSeconds - TTL for completed stream (default 1 hour)
	 */
	finalizeStream: async (
		streamId: string,
		finalContent: string,
		totalTokens: number,
		ttlSeconds: number = 3600,
	): Promise<void> => {
		await Promise.all([
			streamOps.setMetadata(
				streamId,
				{
					status: "completed",
					totalTokens,
					finalContent,
					completedAt: Date.now(),
				},
				ttlSeconds,
			),
			streamOps.completeStream(streamId, ttlSeconds),
		]);
	},

	/**
	 * Mark stream as errored
	 *
	 * @param streamId - Internal stream ID
	 * @param error - Error message
	 * @param ttlSeconds - TTL for error record (default 10 minutes)
	 */
	errorStream: async (
		streamId: string,
		error: string,
		ttlSeconds: number = 600,
	): Promise<void> => {
		await Promise.all([
			streamOps.setMetadata(
				streamId,
				{
					status: "error",
					error,
					completedAt: Date.now(),
				},
				ttlSeconds,
			),
			streamOps.completeStream(streamId, ttlSeconds),
		]);
	},

	/**
	 * Restore stream content from restoration ID
	 *
	 * @param restorationId - User-facing restoration ID
	 * @param cursor - Optional cursor to resume from
	 * @returns Stream data and entries, or null if not found
	 */
	restoreStream: async (
		restorationId: string,
		cursor?: string,
	): Promise<{
		streamId: string;
		metadata: StreamMetadata | null;
		entries: StreamEntry[];
		cursor: string;
	} | null> => {
		const streamId = await restorationOps.getRestoration(restorationId);
		if (!streamId) {
			return null;
		}

		const [metadata, readResult] = await Promise.all([
			streamOps.getMetadata(streamId),
			cursor
				? streamOps.readFromCursor(streamId, cursor)
				: streamOps.readAll(streamId).then((entries) => ({
						entries,
						lastCursor: entries[entries.length - 1]?.id || "0-0",
						hasMore: false,
					})),
		]);

		return {
			streamId,
			metadata,
			entries: readResult.entries,
			cursor: readResult.lastCursor,
		};
	},
};

/**
 * Check if Redis streaming is available
 *
 * @returns True if Redis credentials are configured
 */
export function isRedisStreamingAvailable(): boolean {
	return redis.isConfigured();
}

/**
 * Type exports for consumers
 */
export type { UpstashRedisType as RedisClient };
