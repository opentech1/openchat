/**
 * Upstash Redis REST API client for Convex httpActions
 *
 * Convex httpActions run on Convex infrastructure and cannot use npm packages
 * like @upstash/redis directly. This module uses the Upstash REST API via fetch.
 *
 * ARCHITECTURE:
 * 1. Tokens are pushed to Redis streams during LLM streaming
 * 2. Client connects to Next.js SSE endpoint (/api/stream/[id]) for real-time tokens
 * 3. On completion: single write to Convex with full message
 * 4. Redis streams auto-expire after TTL
 *
 * UPSTASH REST API:
 * - POST https://<url>/pipeline - Execute multiple commands
 * - Headers: Authorization: Bearer <token>
 * - Body: Array of command arrays
 *
 * @see https://upstash.com/docs/redis/sdks/ts/pipelining
 */

import { createLogger } from "./logger";

const logger = createLogger("RedisRest");

// Key prefixes for namespacing
const KEY_PREFIX = {
	stream: "stream:",
	meta: "meta:",
	restoration: "restoration:",
} as const;

/**
 * Stream metadata structure
 */
export interface StreamMetadata {
	status: "streaming" | "completed" | "error";
	totalTokens?: number;
	finalContent?: string;
	error?: string;
	completedAt?: number;
}

/**
 * Check if Redis streaming is available by checking environment variables
 */
export function isRedisAvailable(): boolean {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	return Boolean(url && token);
}

/**
 * Get Redis credentials with validation
 */
function getRedisCredentials(): { url: string; token: string } | null {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;

	if (!url || !token) {
		return null;
	}

	return { url, token };
}

/**
 * Execute a Redis command via REST API
 */
async function executeCommand<T = unknown>(
	command: (string | number)[]
): Promise<T> {
	const creds = getRedisCredentials();
	if (!creds) {
		throw new Error("Redis credentials not configured");
	}

	const response = await fetch(creds.url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${creds.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(command),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Redis command failed: ${response.status} - ${errorText}`);
	}

	const data = await response.json();
	return data.result as T;
}

/**
 * Execute multiple Redis commands in a pipeline
 */
async function executePipeline<T = unknown[]>(
	commands: (string | number)[][]
): Promise<T> {
	const creds = getRedisCredentials();
	if (!creds) {
		throw new Error("Redis credentials not configured");
	}

	const pipelineUrl = `${creds.url}/pipeline`;

	const response = await fetch(pipelineUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${creds.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(commands),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Redis pipeline failed: ${response.status} - ${errorText}`
		);
	}

	const results = await response.json();
	// Pipeline returns array of { result } objects
	return results.map((r: { result: unknown }) => r.result) as T;
}

/**
 * Generate a unique stream ID
 */
export function generateStreamId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 10);
	return `${timestamp}-${random}`;
}

/**
 * Initialize a new Redis stream for token streaming
 *
 * @param restorationId - User-facing restoration ID (e.g., message ID)
 * @param ttlSeconds - Time to live (default 1 hour)
 * @returns Stream ID for internal use
 */
export async function initializeStream(
	restorationId: string,
	ttlSeconds: number = 3600
): Promise<string> {
	const streamId = generateStreamId();

	const metaKey = `${KEY_PREFIX.meta}${streamId}`;
	const restorationKey = `${KEY_PREFIX.restoration}${restorationId}`;

	const metadata: StreamMetadata = { status: "streaming" };

	// Pipeline: SET metadata + SET restoration mapping
	await executePipeline([
		["SET", metaKey, JSON.stringify(metadata), "EX", ttlSeconds],
		["SET", restorationKey, streamId, "EX", ttlSeconds],
	]);

	logger.debug("Stream initialized", { streamId, restorationId });
	return streamId;
}

/**
 * Append tokens to Redis stream (batched)
 *
 * @param streamId - Internal stream ID
 * @param tokens - Array of tokens to append
 */
export async function appendTokenBatch(
	streamId: string,
	tokens: string[]
): Promise<void> {
	if (tokens.length === 0) return;

	const streamKey = `${KEY_PREFIX.stream}${streamId}`;
	const now = Date.now();

	// Build XADD commands for each token
	const commands = tokens.map((token, i) => [
		"XADD",
		streamKey,
		"*",
		"delta",
		token,
		"ts",
		(now + i).toString(),
	]);

	await executePipeline(commands);
}

/**
 * Finalize stream with completed status
 *
 * @param streamId - Internal stream ID
 * @param finalContent - Complete message content
 * @param totalTokens - Total token count
 * @param ttlSeconds - TTL for completed stream (default 1 hour)
 */
export async function finalizeStream(
	streamId: string,
	finalContent: string,
	totalTokens: number,
	ttlSeconds: number = 3600
): Promise<void> {
	const streamKey = `${KEY_PREFIX.stream}${streamId}`;
	const metaKey = `${KEY_PREFIX.meta}${streamId}`;

	const metadata: StreamMetadata = {
		status: "completed",
		totalTokens,
		finalContent,
		completedAt: Date.now(),
	};

	// Pipeline: SET metadata + EXPIRE stream + EXPIRE metadata
	await executePipeline([
		["SET", metaKey, JSON.stringify(metadata), "EX", ttlSeconds],
		["EXPIRE", streamKey, ttlSeconds],
	]);

	logger.debug("Stream finalized", { streamId, totalTokens });
}

/**
 * Mark stream as errored
 *
 * @param streamId - Internal stream ID
 * @param error - Error message
 * @param ttlSeconds - TTL for error record (default 10 minutes)
 */
export async function errorStream(
	streamId: string,
	error: string,
	ttlSeconds: number = 600
): Promise<void> {
	const streamKey = `${KEY_PREFIX.stream}${streamId}`;
	const metaKey = `${KEY_PREFIX.meta}${streamId}`;

	const metadata: StreamMetadata = {
		status: "error",
		error,
		completedAt: Date.now(),
	};

	await executePipeline([
		["SET", metaKey, JSON.stringify(metadata), "EX", ttlSeconds],
		["EXPIRE", streamKey, ttlSeconds],
	]);

	logger.debug("Stream errored", { streamId, error });
}

/**
 * Redis streaming operations for use in httpActions
 */
export const redisStreamOps = {
	isAvailable: isRedisAvailable,
	generateStreamId,
	initializeStream,
	appendTokenBatch,
	finalizeStream,
	errorStream,
};
