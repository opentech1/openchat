import { convertToCoreMessages, smoothStream, streamText, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createHash } from "crypto";
import type { Id } from "@server/convex/_generated/dataModel";

import { captureServerEvent } from "@/lib/posthog-server";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, streamUpsertMessage } from "@/lib/convex-server";
import { resolveAllowedOrigins, validateRequestOrigin } from "@/lib/request-origin";
import { createLogger } from "@/lib/logger";
import { toConvexUserId, toConvexChatId, toConvexStorageId } from "@/lib/type-converters";
import type { IRateLimiter } from "@/lib/rate-limit";
import { hasReasoningCapability } from "@/lib/model-capabilities";
import { isTextPart, isFilePart } from "@/lib/error-handling";
import { removeEmDashes } from "@/lib/text-transforms";
import { EM_DASH_PREVENTION_SYSTEM_PROMPT } from "@/lib/jon-mode-prompts";

type AnyUIMessage = UIMessage<Record<string, unknown>>;

type RateBucket = {
	count: number;
	resetAt: number;
};

// Rate limiting configuration
/** Default maximum requests per minute if not configured via env */
const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;
/** Rate limit window duration in milliseconds (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60_000;
/** Default maximum number of rate limit buckets to track in memory */
const DEFAULT_MAX_TRACKED_BUCKETS = 1_000;

// Message content configuration
/** Maximum characters allowed in user message parts before truncation */
const DEFAULT_MAX_USER_CHARS = 8_000;

// Stream buffering configuration
/** Default interval for flushing buffered stream chunks to database (milliseconds) */
const DEFAULT_STREAM_FLUSH_INTERVAL_MS = 80;
/** Default minimum characters required before flushing a stream chunk */
const DEFAULT_STREAM_MIN_CHARS_PER_FLUSH = 24;
/** Default delay between smooth stream word chunks (milliseconds) */
const DEFAULT_STREAM_SMOOTH_DELAY_MS = 12;

const DEFAULT_RATE_LIMIT = Number(process.env.OPENROUTER_RATE_LIMIT_PER_MIN ?? DEFAULT_RATE_LIMIT_PER_MINUTE);
const RAW_MAX_TRACKED_RATE_BUCKETS = Number(process.env.OPENROUTER_RATE_LIMIT_TRACKED_BUCKETS ?? DEFAULT_MAX_TRACKED_BUCKETS);
const MAX_TRACKED_RATE_BUCKETS = Number.isFinite(RAW_MAX_TRACKED_RATE_BUCKETS) && RAW_MAX_TRACKED_RATE_BUCKETS > 0
	? RAW_MAX_TRACKED_RATE_BUCKETS
	: null;
const MAX_USER_PART_CHARS = Number(process.env.OPENROUTER_MAX_USER_CHARS ?? DEFAULT_MAX_USER_CHARS);

// Request size limits for security
const MAX_MESSAGES_PER_REQUEST = (() => {
	const val = Number(process.env.MAX_MESSAGES_PER_REQUEST ?? 100);
	return Number.isFinite(val) && val > 0 ? val : 100;
})();
const MAX_REQUEST_BODY_SIZE = (() => {
	const val = Number(process.env.MAX_REQUEST_BODY_SIZE ?? 10_000_000);
	return Number.isFinite(val) && val > 0 ? val : 10_000_000;
})();
const MAX_ATTACHMENT_SIZE = (() => {
	const val = Number(process.env.MAX_ATTACHMENT_SIZE ?? 5_000_000);
	return Number.isFinite(val) && val > 0 ? val : 5_000_000;
})();
const MAX_MESSAGE_CONTENT_LENGTH = (() => {
	const val = Number(process.env.MAX_MESSAGE_CONTENT_LENGTH ?? 50_000);
	return Number.isFinite(val) && val > 0 ? val : 50_000;
})();

const STREAM_FLUSH_INTERVAL_RAW = Number(process.env.OPENROUTER_STREAM_FLUSH_INTERVAL_MS ?? DEFAULT_STREAM_FLUSH_INTERVAL_MS);
const STREAM_FLUSH_INTERVAL_MS =
	Number.isFinite(STREAM_FLUSH_INTERVAL_RAW) && STREAM_FLUSH_INTERVAL_RAW > 0
		? STREAM_FLUSH_INTERVAL_RAW
		: DEFAULT_STREAM_FLUSH_INTERVAL_MS;
const STREAM_MIN_CHARS_PER_FLUSH_RAW = Number(
	process.env.OPENROUTER_STREAM_MIN_CHARS_PER_FLUSH ?? DEFAULT_STREAM_MIN_CHARS_PER_FLUSH,
);
const STREAM_MIN_CHARS_PER_FLUSH =
	Number.isFinite(STREAM_MIN_CHARS_PER_FLUSH_RAW) && STREAM_MIN_CHARS_PER_FLUSH_RAW > 0
		? STREAM_MIN_CHARS_PER_FLUSH_RAW
		: DEFAULT_STREAM_MIN_CHARS_PER_FLUSH;
const STREAM_SMOOTH_DELAY_MS = (() => {
	const raw = process.env.OPENROUTER_STREAM_DELAY_MS;
	if (raw === undefined || raw === null || raw.trim() === "") return DEFAULT_STREAM_SMOOTH_DELAY_MS;
	if (raw.trim().toLowerCase() === "null") return null;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return DEFAULT_STREAM_SMOOTH_DELAY_MS;
	return parsed < 0 ? 0 : parsed;
})();
const MAX_TOKENS = (() => {
	const raw = process.env.OPENROUTER_MAX_TOKENS;
	if (!raw || raw.trim() === "") return 8192;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) return 8192;
	return Math.min(parsed, 32768); // Cap at 32k to prevent excessive token usage
})();


/**
 * Convert reasoning config from client to OpenRouter API format
 *
 * OpenRouter unified reasoning API supports:
 * - reasoning.enabled: boolean - Enable reasoning with defaults
 * - reasoning.effort: "low" | "medium" | "high" - For OpenAI/Grok models
 * - reasoning.max_tokens: number - For Anthropic/Gemini models
 * - reasoning.exclude: boolean - Use reasoning but don't include in response
 *
 * Based on: https://openrouter.ai/docs/use-cases/reasoning-tokens
 */
/**
 * Convert reasoning config from client to OpenRouter API format
 *
 * When disabled: Returns undefined - no reasoning parameter sent at all
 * When enabled: Returns reasoning object with either:
 * - effort: "medium" | "high" for OpenAI/Grok models
 * - max_tokens: number for Anthropic/Gemini models
 */
function buildReasoningParam(
	config: ChatRequestPayload["reasoningConfig"],
	modelId: string
): Record<string, unknown> | undefined {
	// When disabled, don't send any reasoning parameter at all
	// This prevents the model from thinking/reasoning entirely
	if (!config || !config.enabled) {
		return undefined;
	}

	const reasoning: Record<string, unknown> = {};

	if (config.effort !== undefined) {
		reasoning.effort = config.effort;
	}

	if (config.max_tokens !== undefined) {
		reasoning.max_tokens = config.max_tokens;
	}

	if (config.exclude !== undefined) {
		reasoning.exclude = config.exclude;
	}

	// If enabled but no specific config, just enable with defaults
	if (Object.keys(reasoning).length === 0) {
		reasoning.enabled = true;
	}

	return reasoning;
}

// PERFORMANCE FIX: Timeout for OpenRouter stream to prevent hanging requests
const OPENROUTER_TIMEOUT_MS = (() => {
	const raw = process.env.OPENROUTER_TIMEOUT_MS;
	if (!raw || raw.trim() === "") return 120000; // Default 2 minutes
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) return 120000;
	return Math.min(parsed, 300000); // Cap at 5 minutes to prevent indefinite hangs
})();

type StreamPersistRequest = {
	userId: string;
	chatId: string;
	clientMessageId?: string | null;
	role: "user" | "assistant";
	content: string;
	reasoning?: string;
	thinkingTimeMs?: number;
	createdAt: string;
	status: "streaming" | "completed";
	attachments?: Array<{
		storageId: Id<"_storage">;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
		url?: string;
	}>;
};

type ChatRequestPayload = {
	modelId?: string;
	apiKey?: string;
	chatId?: string;
	messages?: AnyUIMessage[];
	assistantMessageId?: string;
	attachments?: Array<{
		storageId: Id<"_storage">;
		filename: string;
		contentType: string;
		size: number;
		url?: string;
	}>;
	reasoningConfig?: {
		enabled: boolean;
		effort?: "medium" | "high";
		max_tokens?: number;
		exclude?: boolean;
	};
	jonMode?: boolean;
};

function clampUserText(message: AnyUIMessage): AnyUIMessage {
	if (message.role !== "user") return message;
	let remaining = MAX_USER_PART_CHARS;
	const parts = message.parts.map((part) => {
		if (part?.type !== "text") return part;
		if (remaining <= 0) return { ...part, text: "" };
		if (part.text.length <= remaining) {
			remaining -= part.text.length;
			return part;
		}
		const slice = part.text.slice(0, remaining);
		remaining = 0;
		return { ...part, text: slice };
	});
	return { ...message, parts };
}

function extractMessageText(message: AnyUIMessage): string {
	const segments: string[] = [];
	for (const part of message.parts ?? []) {
		if (!part) continue;
		if (isTextPart(part)) {
			segments.push(part.text);
			continue;
		}
		if (isFilePart(part)) {
			const name = part.filename && part.filename.length > 0 ? part.filename : "attachment";
			const media = part.mediaType && part.mediaType.length > 0 ? ` (${part.mediaType})` : "";
			segments.push(`[Attachment: ${name}${media}]`);
			continue;
		}
	}
	return segments.join("");
}

function coerceIsoDate(value: unknown): string {
	if (typeof value === "string" && value.length > 0) {
		const date = new Date(value);
		if (!Number.isNaN(date.valueOf())) return date.toISOString();
	}
	if (value instanceof Date && !Number.isNaN(value.valueOf())) {
		return value.toISOString();
	}
	return new Date().toISOString();
}

function pickClientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]!.trim();
	try {
		const url = new URL(request.url);
		return url.hostname;
	} catch {
		return "127.0.0.1";
	}
}

/**
 * Anonymize client IP using SHA-256 hash.
 * 
 * Security strategy:
 * - Uses full SHA-256 hash (64 hex chars) for better anonymization
 * - One-way hash prevents reverse-lookup of original IP
 * - Allows correlation of requests from same IP without storing PII
 * - Sufficient for rate limiting and abuse detection
 */
function hashClientIp(ip: string): string {
	try {
		return createHash("sha256").update(ip).digest("hex");
	} catch {
		return "unknown";
	}
}

function buildCorsHeaders(request: Request, allowedOrigin?: string | null) {
	const headers = new Headers();
	if (allowedOrigin) {
		headers.set("Access-Control-Allow-Origin", allowedOrigin);
	}
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
	headers.set("Access-Control-Allow-Credentials", "true");
	headers.set("Vary", "Origin");
	return headers;
}

export type ChatHandlerOptions = {
	streamTextImpl?: typeof streamText;
	convertToCoreMessagesImpl?: typeof convertToCoreMessages;
	provider?: ReturnType<typeof createOpenRouter>;
	model?: string;
	rateLimit?: { limit: number; windowMs: number };
	now?: () => number;
	corsOrigin?: string;
	persistMessage?: (input: StreamPersistRequest) => Promise<{ ok: boolean }>;
	resolveModel?: (input: {
		request: Request;
		payload: ChatRequestPayload;
	}) => Promise<{ provider: ReturnType<typeof createOpenRouter>; modelId: string }>;
};

export function createChatHandler(options: ChatHandlerOptions = {}) {
	const logger = createLogger("ChatHandler");
	const streamTextImpl = options.streamTextImpl ?? streamText;
	const convertToCoreMessagesImpl = options.convertToCoreMessagesImpl ?? convertToCoreMessages;
	const rateLimit = options.rateLimit ?? { limit: DEFAULT_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS };
	const bucketWindowMs = rateLimit.windowMs > 0 ? rateLimit.windowMs : RATE_LIMIT_WINDOW_MS;
	const now = options.now ?? (() => Date.now());
	const corsOrigin = options.corsOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.CORS_ORIGIN;
	const allowedOrigins = resolveAllowedOrigins(corsOrigin);

	const persistMessageImpl =
		options.persistMessage ??
		((input: StreamPersistRequest) =>
			streamUpsertMessage({
				userId: toConvexUserId(input.userId),
				chatId: toConvexChatId(input.chatId),
				clientMessageId: input.clientMessageId ?? undefined,
				role: input.role,
				content: input.content,
				reasoning: input.reasoning,
				thinkingTimeMs: input.thinkingTimeMs,
				status: input.status,
				createdAt: new Date(input.createdAt).getTime(),
				attachments: input.attachments,
			}));

	const buckets = new Map<string, RateBucket>();
	let lastBucketCleanup = 0;

	const cleanupBuckets = (ts: number) => {
		if (buckets.size === 0) return;
		const needsSweep = ts - lastBucketCleanup >= bucketWindowMs || (MAX_TRACKED_RATE_BUCKETS != null && buckets.size > MAX_TRACKED_RATE_BUCKETS);
		if (!needsSweep) return;
		lastBucketCleanup = ts;
		for (const [key, bucket] of buckets) {
			if (ts > bucket.resetAt) {
				buckets.delete(key);
			}
		}
		if (MAX_TRACKED_RATE_BUCKETS != null && buckets.size > MAX_TRACKED_RATE_BUCKETS) {
			const overflow = buckets.size - MAX_TRACKED_RATE_BUCKETS;
			let removed = 0;
			for (const key of buckets.keys()) {
				buckets.delete(key);
				removed += 1;
				if (removed >= overflow) break;
			}
		}
	};

	function isRateLimited(request: Request): boolean {
		if (rateLimit.limit <= 0) return false;
		const ip = pickClientIp(request);
		const ts = now();
		cleanupBuckets(ts);
		const bucket = buckets.get(ip);
		if (!bucket || ts > bucket.resetAt) {
			buckets.set(ip, { count: 1, resetAt: ts + bucketWindowMs });
			return false;
		}
		if (bucket.count >= rateLimit.limit) return true;
		bucket.count += 1;
		return false;
	}

	return async function handler(request: Request): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		const originResult = validateRequestOrigin(request, allowedOrigins);
		if (!originResult.ok) {
			return new Response("Invalid request origin", { status: 403 });
		}
		const allowOrigin = originResult.origin ?? corsOrigin ?? null;
		const session = await getUserContext();
		const convexUserId = await ensureConvexUser({
			id: session.userId,
			email: session.email,
			name: session.name,
			image: session.image,
		});
		const distinctId = session.userId;
		const clientIp = pickClientIp(request);
		const ipHash = hashClientIp(clientIp);
		const requestOriginValue = originResult.origin ?? request.headers.get("origin") ?? allowOrigin ?? null;
		const rateLimitBucketLabel = `${rateLimit.limit}/${bucketWindowMs}`;
		if (isRateLimited(request)) {
			const headers = buildCorsHeaders(request, allowOrigin);
			headers.set("Retry-After", Math.ceil(bucketWindowMs / 1000).toString());
			headers.set("X-RateLimit-Limit", rateLimit.limit.toString());
			headers.set("X-RateLimit-Window", bucketWindowMs.toString());
			captureServerEvent("chat.rate_limited", distinctId, {
				chat_id: null,
				limit: rateLimit.limit,
				window_ms: bucketWindowMs,
				client_ip_hash_trunc: ipHash,
				origin: requestOriginValue,
				rate_limit_bucket: rateLimitBucketLabel,
			});
			return new Response("Too Many Requests", { status: 429, headers });
		}

		// Validate request body size BEFORE loading into memory
		const contentLength = request.headers.get("content-length");
		if (contentLength) {
			const declaredSize = Number.parseInt(contentLength, 10);
			if (!Number.isNaN(declaredSize) && declaredSize > MAX_REQUEST_BODY_SIZE) {
				const headers = buildCorsHeaders(request, allowOrigin);
				return new Response(
					`Request body too large: ${declaredSize} bytes (max: ${MAX_REQUEST_BODY_SIZE} bytes)`,
					{ status: 413, headers }
				);
			}
		}

		let payload: ChatRequestPayload;
		let rawBody: string;
		try {
			rawBody = await request.text();

			// Double-check actual body size after loading (in case Content-Length was missing or incorrect)
			const bodySize = new TextEncoder().encode(rawBody).length;
			if (bodySize > MAX_REQUEST_BODY_SIZE) {
				const headers = buildCorsHeaders(request, allowOrigin);
				return new Response(
					`Request body too large: ${bodySize} bytes (max: ${MAX_REQUEST_BODY_SIZE} bytes)`,
					{ status: 413, headers }
				);
			}

			payload = JSON.parse(rawBody);
		} catch (error) {
			const headers = buildCorsHeaders(request, allowOrigin);
			if (error instanceof SyntaxError) {
				return new Response("Invalid JSON payload", { status: 400, headers });
			}
			throw error;
		}

		const modelIdFromPayload = typeof payload?.modelId === "string" && payload.modelId.trim().length > 0
			? payload.modelId.trim()
			: null;
		const apiKeyFromPayload = typeof payload?.apiKey === "string" && payload.apiKey.trim().length > 0
			? payload.apiKey.trim()
			: null;

		let config: { provider: ReturnType<typeof createOpenRouter>; modelId: string };
		try {
			if (typeof options.resolveModel === "function") {
				config = await options.resolveModel({ request, payload });
			} else if (options.provider && options.model) {
				config = { provider: options.provider, modelId: options.model };
			} else {
				if (!apiKeyFromPayload) {
					throw new Error("Missing apiKey in request payload");
				}
				if (!modelIdFromPayload) {
					throw new Error("Missing modelId in request payload");
				}
				const provider = createOpenRouter({
					apiKey: apiKeyFromPayload,
					baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
					compatibility: "strict",
				});
				config = { provider, modelId: modelIdFromPayload };
			}
		} catch (error) {
			logger.error("Failed to resolve model", error);
			const headers = buildCorsHeaders(request, allowOrigin);
			const messageText = error instanceof Error ? error.message : String(error ?? "");
			const isProduction = process.env.NODE_ENV === "production";
			let status = 500;
			let responseMessage = "Server configuration error";

			// Check for specific known errors
			if (messageText.includes("Missing apiKey")) {
				status = 400;
				responseMessage = "Missing apiKey";
			} else if (messageText.includes("Missing modelId")) {
				status = 400;
				responseMessage = "Missing modelId";
			} else if (!isProduction) {
				// In development, include detailed error for debugging
				responseMessage = messageText || "Server configuration error";
			}

			return new Response(responseMessage, { status, headers });
		}

		const chatId = typeof payload?.chatId === "string" && payload.chatId.trim().length > 0 ? payload.chatId.trim() : null;
		if (!chatId) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Missing chatId", { status: 400, headers });
		}

		const rawMessages: AnyUIMessage[] = Array.isArray(payload?.messages) ? (payload.messages as AnyUIMessage[]) : [];
		if (rawMessages.length === 0) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Missing chat messages", { status: 400, headers });
		}

		// Validate messages array length
		if (rawMessages.length > MAX_MESSAGES_PER_REQUEST) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(
				`Too many messages: ${rawMessages.length} (max: ${MAX_MESSAGES_PER_REQUEST})`,
				{ status: 413, headers }
			);
		}

		// Validate message content length and attachment sizes
		for (let i = 0; i < rawMessages.length; i++) {
			const message = rawMessages[i];
			if (!message) continue;

			// Check each part of the message
			for (const part of message.parts ?? []) {
				if (!part) continue;

				// Validate text content length
				if (isTextPart(part)) {
					const textLength = part.text.length;
					if (textLength > MAX_MESSAGE_CONTENT_LENGTH) {
						const headers = buildCorsHeaders(request, allowOrigin);
						return new Response(
							`Message content too long: ${textLength} characters (max: ${MAX_MESSAGE_CONTENT_LENGTH})`,
							{ status: 413, headers }
						);
					}
				}

				// Validate attachment size - check combined size to prevent bypass
				if (isFilePart(part)) {
					let totalAttachmentSize = 0;

					// Add data URL size if present
					if (typeof part.data === "string") {
						totalAttachmentSize += new TextEncoder().encode(part.data).length;
					}

					// Add url content size if it's a data URL
					if (typeof part.url === "string" && part.url.startsWith("data:")) {
						totalAttachmentSize += new TextEncoder().encode(part.url).length;
					}

					// Check combined size to prevent bypass by splitting content
					if (totalAttachmentSize > MAX_ATTACHMENT_SIZE) {
						const headers = buildCorsHeaders(request, allowOrigin);
						return new Response(
							`Attachment too large: ${totalAttachmentSize} bytes (max: ${MAX_ATTACHMENT_SIZE} bytes)`,
							{ status: 413, headers }
						);
					}
				}
			}
		}

		// Convert Convex attachments to AI SDK file parts
		if (payload.attachments && payload.attachments.length > 0) {
			const { getFileUrl } = await import("@/lib/convex-server");

			// Fetch URLs for all attachments
			const fileParts = await Promise.all(
				payload.attachments.map(async (attachment) => {
					const url = await getFileUrl(
						toConvexStorageId(attachment.storageId),
						convexUserId,
					);
					if (!url) {
						throw new Error(`Failed to get URL for file: ${attachment.filename}`);
					}
					return {
						type: "file" as const,
						mediaType: attachment.contentType,
						url,
						filename: attachment.filename,
					};
				}),
			);

			// Add file parts to the last user message
			const lastUserMessage = rawMessages[rawMessages.length - 1];
			if (lastUserMessage && lastUserMessage.role === "user") {
				lastUserMessage.parts = [
					...(lastUserMessage.parts || []),
					...fileParts,
				];
			}
		}

		const safeMessages = rawMessages.map(clampUserText);
		const userMessageIndex = [...rawMessages].reverse().findIndex((msg) => msg.role === "user");
		if (userMessageIndex === -1) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Missing user message", { status: 400, headers });
		}
		const normalizedIndex = rawMessages.length - 1 - userMessageIndex;
		const rawUserMessage = rawMessages[normalizedIndex]!;
		const safeUserMessage = safeMessages[normalizedIndex]!;
		const userMessageId = typeof rawUserMessage.id === "string" && rawUserMessage.id.length > 0
			? rawUserMessage.id
			: (crypto.randomUUID?.() ?? `user-${Date.now()}`);
		const userCreatedAtIso = coerceIsoDate((rawUserMessage as any)?.metadata?.createdAt);
		const userContent = extractMessageText(safeUserMessage);
		if ((safeUserMessage as any).id !== userMessageId) {
			(safeUserMessage as any).id = userMessageId;
		}

		const assistantMessageId = typeof payload?.assistantMessageId === "string" && payload.assistantMessageId.length > 0
			? payload.assistantMessageId
			: (crypto.randomUUID?.() ?? `assistant-${Date.now()}`);
		const assistantCreatedAtIso = new Date().toISOString();

		try {
			const userResult = await persistMessageImpl({
				userId: convexUserId,
				chatId,
				clientMessageId: userMessageId,
				role: "user",
				content: userContent,
				createdAt: userCreatedAtIso,
				status: "completed",
				attachments: payload.attachments?.map(a => ({
					storageId: toConvexStorageId(a.storageId),
					filename: a.filename,
					contentType: a.contentType,
					size: a.size,
					uploadedAt: Date.now(),
				})),
			});
			if (!userResult.ok) {
				throw new Error("user streamUpsert rejected");
			}
		} catch (error) {
			logger.error("Failed to persist user message", error, { chatId, messageId: userMessageId });
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Failed to persist message", { status: 502, headers });
		}

		try {
			const assistantBootstrap = await persistMessageImpl({
				userId: convexUserId,
				chatId,
				clientMessageId: assistantMessageId,
				role: "assistant",
				content: "",
				createdAt: assistantCreatedAtIso,
				status: "streaming",
			});
			if (!assistantBootstrap.ok) {
				throw new Error("assistant streamUpsert rejected");
			}
		} catch (error) {
			logger.error("Failed to bootstrap assistant message", error, { chatId, messageId: assistantMessageId });
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Failed to persist assistant", { status: 502, headers });
		}

		let assistantText = "";
		let assistantReasoning = "";
		let lastPersistedLength = 0;
		let lastPersistedReasoningLength = 0;
		let flushTimeout: ReturnType<typeof setTimeout> | null = null;
		let pendingFlush: Promise<void> | null = null;
		let pendingResolve: (() => void) | null = null;
		let finalized = false;
		let persistenceError: Error | null = null;
		const startedAt = Date.now();
		let streamStatus: "completed" | "aborted" | "error" = "completed";
		let reasoningStartTime: number | null = null;
		let reasoningEndTime: number | null = null;

		const persistAssistant = async (status: "streaming" | "completed", force = false) => {
			const pendingLength = assistantText.length;
			const pendingReasoningLength = assistantReasoning.length;
			const delta = pendingLength - lastPersistedLength;
			const reasoningDelta = pendingReasoningLength - lastPersistedReasoningLength;
			if (!force && status === "streaming") {
				if (delta <= 0 && reasoningDelta <= 0) return;
				if (delta < STREAM_MIN_CHARS_PER_FLUSH && reasoningDelta < STREAM_MIN_CHARS_PER_FLUSH) return;
			}
			if (delta <= 0 && reasoningDelta <= 0 && !force) {
				return;
			}
			lastPersistedLength = pendingLength;
			lastPersistedReasoningLength = pendingReasoningLength;

			// CRITICAL: Only send reasoning if it's non-empty
			const reasoningToSend = assistantReasoning.length > 0 ? assistantReasoning : undefined;

			// Calculate thinking time duration
			const thinkingTimeMs = reasoningStartTime && reasoningEndTime
				? reasoningEndTime - reasoningStartTime
				: undefined;

			if (status === "completed") {
				logger.debug("Final save - Reasoning status", {
					textLength: assistantText.length,
					reasoningLength: reasoningToSend ? reasoningToSend.length : 0,
					hasReasoning: !!reasoningToSend,
					thinkingTimeMs,
					thinkingTimeSec: thinkingTimeMs ? (thinkingTimeMs / 1000).toFixed(1) : 0,
					reasoningPreview: reasoningToSend ? reasoningToSend.slice(0, 100) : "NONE"
				});
			}

			const response = await persistMessageImpl({
				userId: convexUserId,
				chatId,
				clientMessageId: assistantMessageId,
				role: "assistant",
				content: assistantText,
				reasoning: reasoningToSend,
				thinkingTimeMs,
				createdAt: assistantCreatedAtIso,
				status,
			});
			if (!response.ok) {
				throw new Error("assistant streamUpsert rejected");
			}
		};

		const scheduleStreamFlush = () => {
			if (flushTimeout) return pendingFlush ?? Promise.resolve();
			const promise = new Promise<void>((resolve) => {
				pendingResolve = resolve;
			});
			pendingFlush = promise;
			flushTimeout = setTimeout(async () => {
				flushTimeout = null;
				try {
					await persistAssistant("streaming");
				} catch (error) {
					logger.error("Failed to persist assistant chunk", error);
					if (!persistenceError) {
						persistenceError = error instanceof Error ? error : new Error("Failed to persist assistant chunk");
					}
				} finally {
					pendingResolve?.();
					pendingResolve = null;
					pendingFlush = null;
				}
			}, STREAM_FLUSH_INTERVAL_MS);
			return promise;
		};

		const finalize = async () => {
			if (finalized) return;
			finalized = true;
			if (flushTimeout) {
				clearTimeout(flushTimeout);
				flushTimeout = null;
			}
			const pending = pendingFlush;
			if (pendingResolve) {
				pendingResolve();
				pendingResolve = null;
			}
			pendingFlush = null;
			if (pending) {
				try {
					await pending;
				} catch {
					// ignore
				}
			}
			try {
				await persistAssistant("completed", true);
			} catch (error) {
				logger.error("Failed to persist assistant completion", error);
				if (!persistenceError) {
					persistenceError = error instanceof Error ? error : new Error("Failed to persist assistant completion");
				}
			}
			if (persistenceError) {
				throw persistenceError;
			}
		};

		// PERFORMANCE FIX: Create AbortController with timeout to prevent hanging requests
		// Also link to request.signal so client-side abort (stop button) works
		const abortController = new AbortController();
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		// Forward client abort to our abort controller
		if (request.signal) {
			request.signal.addEventListener("abort", () => {
				abortController.abort(new Error("Client aborted request"));
			});
		}

		try {
			timeoutId = setTimeout(() => {
				logger.error(`OpenRouter stream timeout after ${OPENROUTER_TIMEOUT_MS}ms`, new Error("Stream timeout"));
				abortController.abort(new Error(`Request timeout after ${OPENROUTER_TIMEOUT_MS}ms`));
			}, OPENROUTER_TIMEOUT_MS);

			const hasReasoning = hasReasoningCapability(config.modelId);

			// Build reasoning parameter from client configuration using OpenRouter unified API
			const reasoning = buildReasoningParam(payload.reasoningConfig, config.modelId);

			// Jon Mode: Extract em-dash prevention setting
			const jonMode = payload.jonMode ?? false;

			// DEBUG: Log reasoning config to understand what's being sent
			logger.debug("Reasoning configuration", {
				modelId: config.modelId,
				hasReasoningCapability: hasReasoning,
				reasoningConfigFromClient: payload.reasoningConfig,
				reasoningParamBuilt: reasoning,
				willPassExtraBody: !!reasoning,
			});

			// CRITICAL: Pass reasoning via extraBody when creating the model per OpenRouter AI SDK docs
			// When reasoning is undefined (disabled), NO extraBody is passed at all
			const model = config.provider.chat(config.modelId, {
				...(reasoning && {
					extraBody: {
						reasoning
					}
				})
			});

			// Jon Mode: Prepend system prompt if enabled
			const messagesForModel = jonMode
				? [
					{
						role: "system" as const,
						parts: [{ type: "text" as const, text: EM_DASH_PREVENTION_SYSTEM_PROMPT }]
					},
					...safeMessages
				]
				: safeMessages;

			const result = await streamTextImpl({
				model,
				messages: convertToCoreMessagesImpl(messagesForModel),
				maxOutputTokens: MAX_TOKENS,
				abortSignal: abortController.signal,
				// CRITICAL FIX: Don't apply smoothStream to reasoning models - it blocks reasoning chunks!
				experimental_transform: hasReasoning && reasoning ? undefined : smoothStream({
					delayInMs: STREAM_SMOOTH_DELAY_MS,
					chunking: "word",
				}),
				onChunk: async ({ chunk }) => {
					if (chunk.type === "text-delta" && chunk.text.length > 0) {
						// Jon Mode: Post-processing failsafe - remove em-dashes from chunks
						const textToAdd = jonMode ? removeEmDashes(chunk.text) : chunk.text;
						assistantText += textToAdd;
						scheduleStreamFlush();
					} else if (chunk.type === "reasoning-delta") {
						// Start timer on FIRST reasoning chunk if not started
						if (!reasoningStartTime) {
							reasoningStartTime = Date.now();
							logger.debug("Reasoning started", { startTime: reasoningStartTime });
						}

						const text = (chunk as any).text;
						if (typeof text === "string" && text.length > 0) {
							assistantReasoning += text;
							// Update end time on EVERY chunk (captures last one)
							reasoningEndTime = Date.now();
							scheduleStreamFlush();
						}
					}
				},
				onFinish: async (_event) => {
					if (timeoutId) clearTimeout(timeoutId);
					streamStatus = "completed";

					// CRITICAL FIX: If we have reasoning but no end time, set it now
					if (assistantReasoning.length > 0 && !reasoningEndTime) {
						reasoningEndTime = Date.now();
					}

					const duration = reasoningStartTime && reasoningEndTime
						? reasoningEndTime - reasoningStartTime
						: 0;
					logger.debug("Stream finished", {
						textLength: assistantText.length,
						reasoningLength: assistantReasoning.length,
						hasReasoning: assistantReasoning.length > 0,
						thinkingTimeMs: duration,
					});
					await finalize();
				},
				onAbort: async () => {
					if (timeoutId) clearTimeout(timeoutId);
					streamStatus = "aborted";
					await finalize();
				},
				onError: async ({ error }) => {
					if (timeoutId) clearTimeout(timeoutId);
					logger.error("Chat stream error", error);
					streamStatus = "error";
					await finalize();
				},
			});
			const duration = Date.now() - startedAt;
			const openrouterStatus = streamStatus === "completed" ? "ok" : streamStatus;
			captureServerEvent("chat_message_stream", distinctId, {
				chat_id: chatId,
				model_id: config.modelId,
				user_message_id: userMessageId,
				assistant_message_id: assistantMessageId,
				characters: assistantText.length,
				duration_ms: duration,
				status: streamStatus,
				openrouter_status: openrouterStatus,
				openrouter_latency_ms: duration,
				origin: requestOriginValue,
				ip_hash: ipHash,
				rate_limit_bucket: rateLimitBucketLabel,
			});

			const aiResponse = result.toUIMessageStreamResponse({
				generateMessageId: () => assistantMessageId,
				sendReasoning: hasReasoning,
			});
			const headers = new Headers(aiResponse.headers);
			headers.set("Cache-Control", "no-store, max-age=0");
			headers.set("X-Accel-Buffering", "no");
			headers.set("Connection", "keep-alive");

			const corsHeaders = buildCorsHeaders(request, allowOrigin);
			corsHeaders.forEach((value, key) => {
				headers.set(key, value);
			});

			if (persistenceError) {
				throw persistenceError;
			}

			return new Response(aiResponse.body, {
				status: aiResponse.status,
				headers,
			});
		} catch (error) {
			// Ensure timeout is cleared even if error occurs before callbacks
			if (timeoutId) clearTimeout(timeoutId);
			logger.error("Chat handler error", error, { chatId, modelId: config.modelId });
			try {
				await finalize();
			} catch (finalizeError) {
				logger.error("Chat finalize error", finalizeError);
				if (!persistenceError) {
					persistenceError =
						finalizeError instanceof Error
							? finalizeError
							: new Error(String(finalizeError));
				}
			}
			const duration = Date.now() - startedAt;
			captureServerEvent("chat_message_stream", distinctId, {
				chat_id: chatId,
				model_id: config.modelId,
				user_message_id: userMessageId,
				assistant_message_id: assistantMessageId,
				characters: assistantText.length,
				duration_ms: duration,
				status: "error",
				openrouter_status: "error",
				openrouter_latency_ms: duration,
				origin: requestOriginValue,
				ip_hash: ipHash,
				rate_limit_bucket: rateLimitBucketLabel,
			});
			const headers = buildCorsHeaders(request, allowOrigin);
			const upstreamStatus =
				typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : undefined;
			const isProduction = process.env.NODE_ENV === "production";

			// Handle specific error cases with generic messages in production
			if (upstreamStatus === 401) {
				return new Response("OpenRouter API key invalid", { status: 401, headers });
			}

			// In production, return generic error message; in development, include details
			let errorMessage = "Upstream error";
			if (!isProduction && error instanceof Error) {
				errorMessage = `Upstream error: ${error.message}`;
			}

			return new Response(errorMessage, { status: 502, headers });
		}
	};
}

export function createOptionsHandler(options: { corsOrigin?: string } = {}) {
	const corsOrigin = options.corsOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.CORS_ORIGIN;
	const allowedOrigins = resolveAllowedOrigins(corsOrigin);
	return async function handler(request: Request) {
		const originResult = validateRequestOrigin(request, allowedOrigins);
		if (!originResult.ok) {
			return new Response("Invalid request origin", { status: 403 });
		}
		const headers = buildCorsHeaders(request, originResult.origin ?? corsOrigin ?? null);
		headers.set("Access-Control-Max-Age", "86400");
		return new Response(null, { status: 204, headers });
	};
}

