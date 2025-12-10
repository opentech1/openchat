import { convertToCoreMessages, smoothStream, streamText, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Id } from "@server/convex/_generated/dataModel";

import { captureServerEvent } from "@/lib/posthog-server";
import { getUserContextFromRequest } from "@/lib/auth-server";
import { ensureConvexUser, streamUpsertMessage } from "@/lib/convex-server";
import { resolveAllowedOrigins, validateRequestOrigin } from "@/lib/request-origin";
import { createLogger } from "@/lib/logger";
import { toConvexUserId, toConvexChatId, toConvexStorageId } from "@/lib/type-converters";
import { hasReasoningCapability } from "@/lib/model-capabilities";
import { removeEmDashes } from "@/lib/text-transforms";
import { EM_DASH_PREVENTION_SYSTEM_PROMPT } from "@/lib/jon-mode-prompts";

// Import from modular files
import {
	DEFAULT_RATE_LIMIT,
	RATE_LIMIT_WINDOW_MS,
	MAX_TRACKED_RATE_BUCKETS,
	MAX_MESSAGES_PER_REQUEST,
	MAX_REQUEST_BODY_SIZE,
	MAX_ATTACHMENT_SIZE,
	MAX_MESSAGE_CONTENT_LENGTH,
	MAX_TOKENS,
	OPENROUTER_TIMEOUT_MS,
	OPENROUTER_BASE_URL,
	STREAM_SMOOTH_DELAY_MS,
} from "./config";

import {
	type AnyUIMessage,
	type ChatRequestPayload,
	isReasoningDeltaWithText,
	extractClientIP,
	generateClientHash,
	getErrorStatusCode,
	validateContentLength,
	validateBodySize,
	parseRequestBody,
	clampUserText,
	extractMessageText,
	coerceIsoDate,
	validateMessageContent,
} from "./validation";

import {
	type ChatAttachment,
	processAttachments,
	toPersistableAttachments,
} from "./attachments";

import {
	type StreamPersistRequest,
	createStreamManager,
	createStreamingHeaders,
} from "./streaming";

// ============================================================================
// Types
// ============================================================================

type RateBucket = {
	count: number;
	resetAt: number;
};

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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build CORS headers for response
 */
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
	_modelId: string
): Record<string, unknown> | undefined {
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

// ============================================================================
// Main Handler
// ============================================================================

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
				attachments: input.attachments as Array<{
					storageId: Id<"_storage">;
					filename: string;
					contentType: string;
					size: number;
					uploadedAt: number;
				}> | undefined,
			}));

	// Rate limiting state
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
		const ip = extractClientIP(request);
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

		// Use request-based auth to read cookies directly from request headers
		const session = await getUserContextFromRequest(request);
		if (!session) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Unauthorized", { status: 401, headers });
		}

		const convexUserId = await ensureConvexUser({
			id: session.userId,
			email: session.email,
			name: session.name,
			image: session.image,
		});
		const distinctId = session.userId;
		const clientIp = extractClientIP(request);
		const ipHash = generateClientHash(clientIp);
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
		const contentLengthResult = validateContentLength(request);
		if (!contentLengthResult.isValid) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(contentLengthResult.error, { status: contentLengthResult.statusCode ?? 413, headers });
		}

		let payload: ChatRequestPayload;
		let rawBody: string;
		try {
			rawBody = await request.text();

			// Double-check actual body size after loading
			const bodySize = new TextEncoder().encode(rawBody).length;
			const bodySizeResult = validateBodySize(bodySize);
			if (!bodySizeResult.isValid) {
				const headers = buildCorsHeaders(request, allowOrigin);
				return new Response(bodySizeResult.error, { status: bodySizeResult.statusCode ?? 413, headers });
			}

			const parseResult = parseRequestBody(rawBody);
			if (!parseResult.payload) {
				const headers = buildCorsHeaders(request, allowOrigin);
				return new Response(parseResult.error ?? "Invalid request", { status: parseResult.statusCode ?? 400, headers });
			}
			payload = parseResult.payload;
		} catch (error: unknown) {
			const headers = buildCorsHeaders(request, allowOrigin);
			if (error instanceof SyntaxError) {
				return new Response("Invalid JSON payload", { status: 400, headers });
			}
			throw error;
		}

		// Resolve model configuration
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
					baseURL: OPENROUTER_BASE_URL,
					compatibility: "strict",
				});
				config = { provider, modelId: modelIdFromPayload };
			}
		} catch (error: unknown) {
			logger.error("Failed to resolve model", error);
			const headers = buildCorsHeaders(request, allowOrigin);
			const messageText = error instanceof Error ? error.message : String(error ?? "");
			const isProduction = process.env.NODE_ENV === "production";
			let status = 500;
			let responseMessage = "Server configuration error";

			if (messageText.includes("Missing apiKey")) {
				status = 400;
				responseMessage = "Missing apiKey";
			} else if (messageText.includes("Missing modelId")) {
				status = 400;
				responseMessage = "Missing modelId";
			} else if (!isProduction) {
				responseMessage = messageText || "Server configuration error";
			}

			return new Response(responseMessage, { status, headers });
		}

		// Validate chatId
		const chatId = typeof payload?.chatId === "string" && payload.chatId.trim().length > 0 ? payload.chatId.trim() : null;
		if (!chatId) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Missing chatId", { status: 400, headers });
		}

		// Validate messages
		const rawMessages: AnyUIMessage[] = Array.isArray(payload?.messages) ? (payload.messages as AnyUIMessage[]) : [];
		if (rawMessages.length === 0) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Missing chat messages", { status: 400, headers });
		}

		if (rawMessages.length > MAX_MESSAGES_PER_REQUEST) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(
				`Too many messages: ${rawMessages.length} (max: ${MAX_MESSAGES_PER_REQUEST})`,
				{ status: 413, headers }
			);
		}

		// Validate message content lengths and attachment sizes
		const contentValidation = validateMessageContent(rawMessages);
		if (!contentValidation.isValid) {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response(contentValidation.error, { status: contentValidation.statusCode ?? 413, headers });
		}

		// Convert Convex attachments to AI SDK file parts
		if (payload.attachments && payload.attachments.length > 0) {
			const { getFileUrl } = await import("@/lib/convex-server");

			const fileParts = await processAttachments(
				payload.attachments as ChatAttachment[],
				(storageId) => getFileUrl(toConvexStorageId(storageId as unknown as Id<"_storage">), convexUserId)
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
		const userCreatedAtIso = coerceIsoDate(rawUserMessage.metadata?.createdAt);
		const userContent = extractMessageText(safeUserMessage);
		if (safeUserMessage.id !== userMessageId) {
			(safeUserMessage as { id: string }).id = userMessageId;
		}

		const assistantMessageId = typeof payload?.assistantMessageId === "string" && payload.assistantMessageId.length > 0
			? payload.assistantMessageId
			: (crypto.randomUUID?.() ?? `assistant-${Date.now()}`);
		const assistantCreatedAtIso = new Date().toISOString();

		// Persist user message and bootstrap assistant message in PARALLEL
		try {
			const [userResult, assistantBootstrap] = await Promise.all([
				persistMessageImpl({
					userId: convexUserId,
					chatId,
					clientMessageId: userMessageId,
					role: "user",
					content: userContent,
					createdAt: userCreatedAtIso,
					status: "completed",
					attachments: toPersistableAttachments(
						payload.attachments as ChatAttachment[] | undefined,
						toConvexStorageId
					),
				}),
				persistMessageImpl({
					userId: convexUserId,
					chatId,
					clientMessageId: assistantMessageId,
					role: "assistant",
					content: "",
					createdAt: assistantCreatedAtIso,
					status: "streaming",
				}),
			]);

			if (!userResult.ok) {
				throw new Error("user streamUpsert rejected");
			}
			if (!assistantBootstrap.ok) {
				throw new Error("assistant streamUpsert rejected");
			}
		} catch (error: unknown) {
			logger.error("Failed to persist messages", error, { chatId, userMessageId, assistantMessageId });
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Failed to persist messages", { status: 502, headers });
		}

		// Create stream manager for buffered persistence
		const streamManager = createStreamManager({
			userId: convexUserId,
			chatId,
			assistantMessageId,
			assistantCreatedAtIso,
			persistMessage: persistMessageImpl,
		});

		const startedAt = Date.now();

		// Create AbortController for timeout protection only
		const abortController = new AbortController();
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		try {
			timeoutId = setTimeout(() => {
				logger.error(`OpenRouter stream timeout after ${OPENROUTER_TIMEOUT_MS}ms`, new Error("Stream timeout"));
				abortController.abort(new Error(`Request timeout after ${OPENROUTER_TIMEOUT_MS}ms`));
			}, OPENROUTER_TIMEOUT_MS);

			const hasReasoning = hasReasoningCapability(config.modelId);
			const reasoning = buildReasoningParam(payload.reasoningConfig, config.modelId);
			const jonMode = payload.jonMode ?? false;

			logger.debug("Reasoning configuration", {
				modelId: config.modelId,
				hasReasoningCapability: hasReasoning,
				reasoningConfigFromClient: payload.reasoningConfig,
				reasoningParamBuilt: reasoning,
				willPassExtraBody: !!reasoning,
			});

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
				experimental_transform: hasReasoning && reasoning ? undefined : smoothStream({
					delayInMs: STREAM_SMOOTH_DELAY_MS,
					chunking: "word",
				}),
				onChunk: async ({ chunk }) => {
					if (chunk.type === "text-delta" && chunk.text.length > 0) {
						const textToAdd = jonMode ? removeEmDashes(chunk.text) : chunk.text;
						streamManager.appendText(textToAdd);
						streamManager.scheduleFlush();
					} else if (isReasoningDeltaWithText(chunk)) {
						if (chunk.text.length > 0) {
							streamManager.appendReasoning(chunk.text);
							streamManager.scheduleFlush();
						}
					}
				},
				onFinish: async (_event) => {
					if (timeoutId) clearTimeout(timeoutId);
					logger.debug("Stream finished", {
						textLength: streamManager.state.fullText.length,
						reasoningLength: streamManager.state.reasoningText.length,
						hasReasoning: streamManager.state.reasoningText.length > 0,
					});
					await streamManager.finalize();
				},
				onAbort: async () => {
					if (timeoutId) clearTimeout(timeoutId);
					streamManager.markAborted();
					await streamManager.finalize();
				},
				onError: async ({ error }) => {
					if (timeoutId) clearTimeout(timeoutId);
					logger.error("Chat stream error", error);
					streamManager.markError();
					await streamManager.finalize();
				},
			});

			// Consume the stream to ensure it runs to completion
			result.consumeStream();

			const duration = Date.now() - startedAt;
			const streamStatus = streamManager.state.status;
			const openrouterStatus = streamStatus === "completed" ? "ok" : streamStatus;
			captureServerEvent("chat_message_stream", distinctId, {
				chat_id: chatId,
				model_id: config.modelId,
				user_message_id: userMessageId,
				assistant_message_id: assistantMessageId,
				characters: streamManager.state.fullText.length,
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

			const corsHeaders = buildCorsHeaders(request, allowOrigin);
			const headers = createStreamingHeaders(aiResponse.headers, corsHeaders);

			const persistenceError = streamManager.getPersistenceError();
			if (persistenceError) {
				throw persistenceError;
			}

			return new Response(aiResponse.body, {
				status: aiResponse.status,
				headers,
			});
		} catch (error: unknown) {
			if (timeoutId) clearTimeout(timeoutId);
			logger.error("Chat handler error", error, { chatId, modelId: config.modelId });

			try {
				await streamManager.finalize();
			} catch (finalizeError: unknown) {
				logger.error("Chat finalize error", finalizeError);
			}

			const duration = Date.now() - startedAt;
			captureServerEvent("chat_message_stream", distinctId, {
				chat_id: chatId,
				model_id: config.modelId,
				user_message_id: userMessageId,
				assistant_message_id: assistantMessageId,
				characters: streamManager.state.fullText.length,
				duration_ms: duration,
				status: "error",
				openrouter_status: "error",
				openrouter_latency_ms: duration,
				origin: requestOriginValue,
				ip_hash: ipHash,
				rate_limit_bucket: rateLimitBucketLabel,
			});

			const headers = buildCorsHeaders(request, allowOrigin);
			const upstreamStatus = getErrorStatusCode(error);
			const isProduction = process.env.NODE_ENV === "production";

			if (upstreamStatus === 401) {
				return new Response("OpenRouter API key invalid", { status: 401, headers });
			}

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
