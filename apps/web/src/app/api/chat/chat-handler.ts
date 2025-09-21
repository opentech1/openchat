import { streamText, convertToCoreMessages, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import { serverClient } from "@/utils/orpc-server";

type AnyUIMessage = UIMessage<Record<string, unknown>>;

type RateBucket = {
	count: number;
	resetAt: number;
};

const DEFAULT_RATE_LIMIT = Number(process.env.OPENROUTER_RATE_LIMIT_PER_MIN ?? 30);
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_USER_PART_CHARS = Number(process.env.OPENROUTER_MAX_USER_CHARS ?? 8_000);
const STREAM_FLUSH_INTERVAL_MS = Number(process.env.OPENROUTER_STREAM_FLUSH_INTERVAL_MS ?? 50);

type StreamPersistRequest = {
	chatId: string;
	messageId: string;
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
	return message.parts
		.filter((part): part is { type: "text"; text: string } => part?.type === "text")
		.map((part) => part.text)
		.join("");
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

function buildCorsHeaders(request: Request, overrideOrigin?: string) {
	const origin = overrideOrigin ?? request.headers.get("origin") ?? "*";
	const headers = new Headers();
	headers.set("Access-Control-Allow-Origin", origin === "null" ? "*" : origin);
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
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
};

export function createChatHandler(options: ChatHandlerOptions = {}) {
	const streamTextImpl = options.streamTextImpl ?? streamText;
	const convertToCoreMessagesImpl = options.convertToCoreMessagesImpl ?? convertToCoreMessages;
	const rateLimit = options.rateLimit ?? { limit: DEFAULT_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS };
	const now = options.now ?? (() => Date.now());
	const corsOrigin = options.corsOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.CORS_ORIGIN;

	const persistMessageImpl = options.persistMessage ?? ((input: StreamPersistRequest) => serverClient.messages.streamUpsert(input));

	let provider = options.provider;
	let modelId = options.model;

	const ensureConfig = () => {
		if (!provider) {
			const apiKey = process.env.OPENROUTER_API_KEY;
			if (!apiKey) throw new Error("Missing required env: OPENROUTER_API_KEY");
			provider = createOpenRouter({
				apiKey,
				baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
				compatibility: "strict",
			});
		}
		if (!modelId) {
			const envModel = process.env.OPENROUTER_MODEL;
			if (!envModel) throw new Error("Missing required env: OPENROUTER_MODEL");
			modelId = envModel;
		}
		return { provider: provider!, modelId: modelId! };
	};

	const buckets = new Map<string, RateBucket>();

	function isRateLimited(request: Request): boolean {
		if (rateLimit.limit <= 0) return false;
		const ip = pickClientIp(request);
		const bucket = buckets.get(ip);
		const ts = now();
		if (!bucket || ts > bucket.resetAt) {
			buckets.set(ip, { count: 1, resetAt: ts + rateLimit.windowMs });
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

		if (isRateLimited(request)) {
			const headers = buildCorsHeaders(request, corsOrigin);
			headers.set("Retry-After", Math.ceil(rateLimit.windowMs / 1000).toString());
			return new Response("Too Many Requests", { status: 429, headers });
		}

		let config: { provider: ReturnType<typeof createOpenRouter>; modelId: string };
		try {
			config = ensureConfig();
		} catch (error) {
			console.error("/api/chat configuration", error);
			const headers = buildCorsHeaders(request, corsOrigin);
			return new Response("Server configuration error", { status: 500, headers });
		}

		let payload: any;
		try {
			payload = await request.json();
		} catch {
			const headers = buildCorsHeaders(request, corsOrigin);
			return new Response("Invalid JSON payload", { status: 400, headers });
		}

		const chatId = typeof payload?.chatId === "string" && payload.chatId.trim().length > 0 ? payload.chatId.trim() : null;
		if (!chatId) {
			const headers = buildCorsHeaders(request, corsOrigin);
			return new Response("Missing chatId", { status: 400, headers });
		}

		const rawMessages: AnyUIMessage[] = Array.isArray(payload?.messages) ? (payload.messages as AnyUIMessage[]) : [];
		if (rawMessages.length === 0) {
			const headers = buildCorsHeaders(request, corsOrigin);
			return new Response("Missing chat messages", { status: 400, headers });
		}

		const safeMessages = rawMessages.map(clampUserText);
		const userMessageIndex = [...rawMessages].reverse().findIndex((msg) => msg.role === "user");
		if (userMessageIndex === -1) {
			const headers = buildCorsHeaders(request, corsOrigin);
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
				chatId,
				messageId: userMessageId,
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
			const headers = buildCorsHeaders(request, corsOrigin);
			return new Response("Failed to persist message", { status: 502, headers });
		}

		try {
			const assistantBootstrap = await persistMessageImpl({
				chatId,
				messageId: assistantMessageId,
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
			const headers = buildCorsHeaders(request, corsOrigin);
			return new Response("Failed to persist assistant", { status: 502, headers });
		}

		let assistantText = "";
		let lastPersistedLength = 0;
		let flushTimeout: ReturnType<typeof setTimeout> | null = null;
		let pendingFlush: Promise<void> | null = null;
		let pendingResolve: (() => void) | null = null;
		let finalized = false;

		const persistAssistant = async (status: "streaming" | "completed", force = false) => {
			if (!force && status === "streaming" && assistantText.length === lastPersistedLength) {
				return;
			}
			lastPersistedLength = assistantText.length;
			try {
				const response = await persistMessageImpl({
					chatId,
					messageId: assistantMessageId,
					role: "assistant",
					content: assistantText,
					createdAt: assistantCreatedAtIso,
					status,
				});
				if (!response.ok) {
					throw new Error("assistant streamUpsert rejected");
				}
			} catch (error) {
				console.error("Failed to persist assistant chunk", error);
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
			await persistAssistant("completed", true);
		};

		try {
			const result = await streamTextImpl({
				model: config.provider.chat(config.modelId),
				messages: convertToCoreMessagesImpl(safeMessages),
				onChunk: async ({ chunk }) => {
					if (chunk.type === "text-delta" && chunk.text.length > 0) {
						assistantText += chunk.text;
						scheduleStreamFlush();
					}
				},
				onFinish: async () => {
					await finalize();
				},
				onAbort: async () => {
					await finalize();
				},
				onError: async ({ error }) => {
					console.error("/api/chat stream", error);
					await finalize();
				},
			});

			const aiResponse = result.toUIMessageStreamResponse({
				generateMessageId: () => assistantMessageId,
			});
			const headers = new Headers(aiResponse.headers);
			headers.set("Cache-Control", "no-store, max-age=0");
			headers.set("X-Accel-Buffering", "no");
			headers.set("Connection", "keep-alive");

			const corsHeaders = buildCorsHeaders(request, corsOrigin);
			corsHeaders.forEach((value, key) => {
				headers.set(key, value);
			});

			return new Response(aiResponse.body, {
				status: aiResponse.status,
				headers,
			});
		} catch (error) {
			console.error("/api/chat", error);
			await finalize();
			const headers = buildCorsHeaders(request, corsOrigin);
			return new Response("Upstream error", { status: 502, headers });
		}
	};
}

export function createOptionsHandler(options: { corsOrigin?: string } = {}) {
	const corsOrigin = options.corsOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.CORS_ORIGIN;
	return async function handler(request: Request) {
		const headers = buildCorsHeaders(request, corsOrigin);
		headers.set("Access-Control-Max-Age", "86400");
		return new Response(null, { status: 204, headers });
	};
}
