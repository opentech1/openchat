import { convertToCoreMessages, smoothStream, streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createHash } from "crypto";

import { captureServerEvent } from "@/lib/posthog-server";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, streamUpsertMessage } from "@/lib/convex-server";
import { resolveAllowedOrigins, validateRequestOrigin } from "@/lib/request-origin";
import { createLogger } from "@/lib/logger";
import { toConvexUserId, toConvexChatId, toConvexStorageId } from "@/lib/type-converters";
import { hasReasoningCapability } from "@/lib/model-capabilities";
import {
	RATE_LIMITS,
	DEFAULT_RATE_LIMIT,
	MAX_TRACKED_RATE_BUCKETS,
	MAX_USER_PART_CHARS,
	MAX_MESSAGES_PER_REQUEST,
	MAX_REQUEST_BODY_SIZE,
	MAX_ATTACHMENT_SIZE,
	MAX_MESSAGE_CONTENT_LENGTH,
	STREAM_FLUSH_INTERVAL_MS,
	STREAM_MIN_CHARS_PER_FLUSH,
	STREAM_SMOOTH_DELAY_MS,
	MAX_TOKENS,
	OPENROUTER_TIMEOUT_MS,
} from "@/config/constants";
import type {
	AnyUIMessage,
	ChatRequestPayload,
	StreamPersistRequest,
	OpenRouterError,
} from "./chat-handler-types";
import {
	getMessageId,
	getMessageCreatedAt,
	isOpenRouterError,
	isReasoningStreamChunk,
} from "./chat-handler-types";
import {
	validateRequestBodySize,
	validateActualBodySize,
	validateMessagesLength,
	validateMessageContent,
	validateChatId,
	validateMessages,
	findLastUserMessage,
	clampUserText,
	extractMessageText,
} from "./chat-handler-validation";
import { StreamManager } from "./chat-handler-streaming";
import { PersistenceHandler, coerceIsoDate } from "./chat-handler-persistence";

type RateBucket = {
	count: number;
	resetAt: number;
};


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
	const rateLimit = options.rateLimit ?? { limit: DEFAULT_RATE_LIMIT, windowMs: RATE_LIMITS.WINDOW_MS };
	const bucketWindowMs = rateLimit.windowMs > 0 ? rateLimit.windowMs : RATE_LIMITS.WINDOW_MS;
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
		const bodySizeCheck = validateRequestBodySize(request);
		if (!bodySizeCheck.valid) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(bodySizeCheck.error, { status: 413, headers });
		}

		let payload: ChatRequestPayload;
		let rawBody: string;
		try {
			rawBody = await request.text();

			// Double-check actual body size after loading
			const actualSizeCheck = validateActualBodySize(rawBody);
			if (!actualSizeCheck.valid) {
				const headers = buildCorsHeaders(request, allowOrigin);
				return new Response(actualSizeCheck.error, { status: 413, headers });
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

		// Validate chat ID
		const chatIdValidation = validateChatId(payload);
		if (!chatIdValidation.valid) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(chatIdValidation.error, { status: 400, headers });
		}
		const chatId = chatIdValidation.chatId!;

		// Validate messages exist
		const messagesValidation = validateMessages(payload);
		if (!messagesValidation.valid) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(messagesValidation.error, { status: 400, headers });
		}
		const rawMessages = messagesValidation.messages!;

		// Validate messages array length
		const lengthValidation = validateMessagesLength(rawMessages);
		if (!lengthValidation.valid) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(lengthValidation.error, { status: 413, headers });
		}

		// Validate message content length and attachment sizes
		const contentValidation = validateMessageContent(rawMessages);
		if (!contentValidation.valid) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(contentValidation.error, { status: 413, headers });
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
		const userMessageResult = findLastUserMessage(rawMessages);
		if (!userMessageResult.found) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(userMessageResult.error, { status: 400, headers });
		}
		const rawUserMessage = userMessageResult.message!;
		const safeUserMessage = safeMessages[userMessageResult.index!]!;
		const userMessageId = getMessageId(rawUserMessage);
		const userCreatedAtIso = getMessageCreatedAt(rawUserMessage);
		const userContent = extractMessageText(safeUserMessage);
		// Ensure message has the correct ID
		if (safeUserMessage.id !== userMessageId) {
			safeUserMessage.id = userMessageId;
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

			const result = await streamTextImpl({
				model,
				messages: convertToCoreMessagesImpl(safeMessages),
				maxOutputTokens: MAX_TOKENS,
				abortSignal: abortController.signal,
				// CRITICAL FIX: Don't apply smoothStream to reasoning models - it blocks reasoning chunks!
				experimental_transform: hasReasoning && reasoning ? undefined : smoothStream({
					delayInMs: STREAM_SMOOTH_DELAY_MS,
					chunking: "word",
				}),
				onChunk: async ({ chunk }) => {
					if (chunk.type === "text-delta" && chunk.text.length > 0) {
						assistantText += chunk.text;
						scheduleStreamFlush();
					} else if (chunk.type === "reasoning-delta") {
						// Start timer on FIRST reasoning chunk if not started
						if (!reasoningStartTime) {
							reasoningStartTime = Date.now();
							logger.debug("Reasoning started", { startTime: reasoningStartTime });
						}

						// Type-safe check for reasoning chunk
						if (isReasoningStreamChunk(chunk) && chunk.text.length > 0) {
							assistantReasoning += chunk.text;
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

			// Type-safe error status code extraction
			const upstreamStatus = isOpenRouterError(error) ? error.statusCode : undefined;
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

