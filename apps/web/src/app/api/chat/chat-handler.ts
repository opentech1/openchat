import { convertToCoreMessages, smoothStream, streamText, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createHash } from "crypto";
import type { Id } from "@server/convex/_generated/dataModel";

import { captureServerEvent } from "@/lib/posthog-server";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, streamUpsertMessage } from "@/lib/convex-server";
import { resolveAllowedOrigins, validateRequestOrigin } from "@/lib/request-origin";

type AnyUIMessage = UIMessage<Record<string, unknown>>;

type RateBucket = {
	count: number;
	resetAt: number;
};

const DEFAULT_RATE_LIMIT = Number(process.env.OPENROUTER_RATE_LIMIT_PER_MIN ?? 30);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RAW_MAX_TRACKED_RATE_BUCKETS = Number(process.env.OPENROUTER_RATE_LIMIT_TRACKED_BUCKETS ?? 1_000);
const MAX_TRACKED_RATE_BUCKETS = Number.isFinite(RAW_MAX_TRACKED_RATE_BUCKETS) && RAW_MAX_TRACKED_RATE_BUCKETS > 0
	? RAW_MAX_TRACKED_RATE_BUCKETS
	: null;
const MAX_USER_PART_CHARS = Number(process.env.OPENROUTER_MAX_USER_CHARS ?? 8_000);
const STREAM_FLUSH_INTERVAL_RAW = Number(process.env.OPENROUTER_STREAM_FLUSH_INTERVAL_MS ?? 80);
const STREAM_FLUSH_INTERVAL_MS =
	Number.isFinite(STREAM_FLUSH_INTERVAL_RAW) && STREAM_FLUSH_INTERVAL_RAW > 0
		? STREAM_FLUSH_INTERVAL_RAW
		: 80;
const STREAM_MIN_CHARS_PER_FLUSH_RAW = Number(
	process.env.OPENROUTER_STREAM_MIN_CHARS_PER_FLUSH ?? 24,
);
const STREAM_MIN_CHARS_PER_FLUSH =
	Number.isFinite(STREAM_MIN_CHARS_PER_FLUSH_RAW) && STREAM_MIN_CHARS_PER_FLUSH_RAW > 0
		? STREAM_MIN_CHARS_PER_FLUSH_RAW
		: 24;
const STREAM_SMOOTH_DELAY_MS = (() => {
	const raw = process.env.OPENROUTER_STREAM_DELAY_MS;
	if (raw === undefined || raw === null || raw.trim() === "") return 12;
	if (raw.trim().toLowerCase() === "null") return null;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return 12;
	return parsed < 0 ? 0 : parsed;
})();

type StreamPersistRequest = {
	userId: string;
	chatId: string;
	clientMessageId?: string | null;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
	status: "streaming" | "completed";
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
		if ((part as any).type === "text" && typeof (part as any).text === "string") {
			segments.push((part as any).text);
			continue;
		}
		if ((part as any).type === "file") {
			const filePart = part as { filename?: string; mediaType?: string };
			const name = filePart.filename && filePart.filename.length > 0 ? filePart.filename : "attachment";
			const media = filePart.mediaType && filePart.mediaType.length > 0 ? ` (${filePart.mediaType})` : "";
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

function hashClientIp(ip: string): string {
	try {
		return createHash("sha256").update(ip).digest("hex").slice(0, 16);
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
		payload: any;
	}) => Promise<{ provider: ReturnType<typeof createOpenRouter>; modelId: string }>;
};

export function createChatHandler(options: ChatHandlerOptions = {}) {
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
				userId: input.userId as Id<"users">,
				chatId: input.chatId as Id<"chats">,
				clientMessageId: input.clientMessageId ?? undefined,
				role: input.role,
				content: input.content,
				status: input.status,
				createdAt: new Date(input.createdAt).getTime(),
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

		let payload: any;
		try {
			payload = await request.json();
		} catch {
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Invalid JSON payload", { status: 400, headers });
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
			console.error("/api/chat resolve model", error);
			const headers = buildCorsHeaders(request, allowOrigin);
			const messageText = error instanceof Error ? error.message : String(error ?? "");
			let status = 500;
			let responseMessage = "Server configuration error";
			if (messageText.includes("Missing apiKey")) {
				status = 400;
				responseMessage = "Missing apiKey";
			} else if (messageText.includes("Missing modelId")) {
				status = 400;
				responseMessage = "Missing modelId";
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
			});
			if (!userResult.ok) {
				throw new Error("user streamUpsert rejected");
			}
		} catch (error) {
			console.error("Failed to persist user message", error);
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
			console.error("Failed to bootstrap assistant message", error);
			const headers = buildCorsHeaders(request, allowOrigin);
			return new Response("Failed to persist assistant", { status: 502, headers });
		}

		let assistantText = "";
		let lastPersistedLength = 0;
		let flushTimeout: ReturnType<typeof setTimeout> | null = null;
		let pendingFlush: Promise<void> | null = null;
		let pendingResolve: (() => void) | null = null;
		let finalized = false;
		let persistenceError: Error | null = null;
		const startedAt = Date.now();
		let streamStatus: "completed" | "aborted" | "error" = "completed";

		const persistAssistant = async (status: "streaming" | "completed", force = false) => {
			const pendingLength = assistantText.length;
			const delta = pendingLength - lastPersistedLength;
			if (!force && status === "streaming") {
				if (delta <= 0) return;
				if (delta < STREAM_MIN_CHARS_PER_FLUSH) return;
			}
			if (delta <= 0 && !force) {
				return;
			}
			lastPersistedLength = pendingLength;
			const response = await persistMessageImpl({
				userId: convexUserId,
				chatId,
				clientMessageId: assistantMessageId,
				role: "assistant",
				content: assistantText,
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
					console.error("Failed to persist assistant chunk", error);
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
				console.error("Failed to persist assistant completion", error);
				if (!persistenceError) {
					persistenceError = error instanceof Error ? error : new Error("Failed to persist assistant completion");
				}
			}
			if (persistenceError) {
				throw persistenceError;
			}
		};

		try {
			const model = config.provider.chat(config.modelId);
			const result = await streamTextImpl({
				model,
				messages: convertToCoreMessagesImpl(safeMessages),
				experimental_transform: smoothStream({
					delayInMs: STREAM_SMOOTH_DELAY_MS,
					chunking: "word",
				}),
				onChunk: async ({ chunk }) => {
					if (chunk.type === "text-delta" && chunk.text.length > 0) {
						assistantText += chunk.text;
						scheduleStreamFlush();
					}
				},
				onFinish: async () => {
					streamStatus = "completed";
					await finalize();
				},
				onAbort: async () => {
					streamStatus = "aborted";
					await finalize();
				},
				onError: async ({ error }) => {
					console.error("/api/chat stream", error);
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
			console.error("/api/chat", error);
			try {
				await finalize();
			} catch (finalizeError) {
				console.error("/api/chat finalize", finalizeError);
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
			if (upstreamStatus === 401) {
				return new Response("OpenRouter API key invalid", { status: 401, headers });
			}
			return new Response("Upstream error", { status: 502, headers });
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
