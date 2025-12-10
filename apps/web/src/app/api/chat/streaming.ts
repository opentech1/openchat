/**
 * Chat streaming utilities and state management
 *
 * This module extracts streaming-related logic from chat-handler.ts for better
 * separation of concerns. It handles:
 * - Stream state management (text, reasoning, tokens)
 * - Persistence callbacks (buffered writes to Convex)
 * - Stream finalization
 */

import { createLogger } from "@/lib/logger";
import {
	STREAM_FLUSH_INTERVAL_MS,
	STREAM_MIN_CHARS_PER_FLUSH,
} from "./config";

const logger = createLogger("Streaming");

// ============================================================================
// Types
// ============================================================================

/**
 * Stream state tracks accumulated content during streaming
 */
export interface StreamState {
	/** Accumulated assistant response text */
	fullText: string;
	/** Accumulated reasoning/thinking text (for models that support it) */
	reasoningText: string;
	/** Whether the stream has finished */
	isFinished: boolean;
	/** Stream completion status */
	status: "streaming" | "completed" | "aborted" | "error";
	/** Timestamp when reasoning started (ms since epoch) */
	reasoningStartTime: number | null;
	/** Timestamp when reasoning ended (ms since epoch) */
	reasoningEndTime: number | null;
}

/**
 * Persistence request payload for saving messages to database
 */
export interface StreamPersistRequest {
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
		storageId: unknown;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
	}>;
}

/**
 * Persistence function signature
 */
export type PersistMessageFn = (input: StreamPersistRequest) => Promise<{ ok: boolean }>;

/**
 * Configuration for creating a stream manager
 */
export interface StreamManagerConfig {
	/** User ID for persistence */
	userId: string;
	/** Chat ID for persistence */
	chatId: string;
	/** Client-provided message ID for the assistant message */
	assistantMessageId: string;
	/** ISO timestamp for when the assistant message was created */
	assistantCreatedAtIso: string;
	/** Function to persist messages to the database */
	persistMessage: PersistMessageFn;
	/** Optional custom flush interval in ms */
	flushIntervalMs?: number;
	/** Optional custom minimum chars per flush */
	minCharsPerFlush?: number;
}

/**
 * Stream manager handles buffered persistence of streaming content
 */
export interface StreamManager {
	/** Current stream state */
	readonly state: Readonly<StreamState>;
	/** Add text to the accumulated response */
	appendText(text: string): void;
	/** Add reasoning text to the accumulated response */
	appendReasoning(text: string): void;
	/** Schedule a flush of accumulated content (debounced) */
	scheduleFlush(): Promise<void>;
	/** Finalize the stream and persist final state */
	finalize(): Promise<void>;
	/** Get any persistence error that occurred */
	getPersistenceError(): Error | null;
	/** Mark stream as aborted */
	markAborted(): void;
	/** Mark stream as errored */
	markError(): void;
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Create initial stream state
 */
export function createStreamState(): StreamState {
	return {
		fullText: "",
		reasoningText: "",
		isFinished: false,
		status: "streaming",
		reasoningStartTime: null,
		reasoningEndTime: null,
	};
}

// ============================================================================
// Stream Manager
// ============================================================================

/**
 * Create a stream manager for handling buffered persistence
 *
 * The stream manager:
 * - Accumulates text and reasoning content
 * - Buffers writes to reduce database round-trips
 * - Handles finalization and error recovery
 *
 * @example
 * ```ts
 * const manager = createStreamManager({
 *   userId: "user_123",
 *   chatId: "chat_456",
 *   assistantMessageId: "msg_789",
 *   assistantCreatedAtIso: new Date().toISOString(),
 *   persistMessage: async (input) => {
 *     await db.upsertMessage(input);
 *     return { ok: true };
 *   },
 * });
 *
 * // In streaming callbacks:
 * manager.appendText(chunk.text);
 * manager.scheduleFlush();
 *
 * // On completion:
 * await manager.finalize();
 * ```
 */
export function createStreamManager(config: StreamManagerConfig): StreamManager {
	const {
		userId,
		chatId,
		assistantMessageId,
		assistantCreatedAtIso,
		persistMessage,
		flushIntervalMs = STREAM_FLUSH_INTERVAL_MS,
		minCharsPerFlush = STREAM_MIN_CHARS_PER_FLUSH,
	} = config;

	// Internal state
	const state = createStreamState();
	let lastPersistedLength = 0;
	let lastPersistedReasoningLength = 0;
	let flushTimeout: ReturnType<typeof setTimeout> | null = null;
	let pendingFlush: Promise<void> | null = null;
	let pendingResolve: (() => void) | null = null;
	let finalized = false;
	let persistenceError: Error | null = null;

	/**
	 * Persist assistant message to database
	 */
	const persistAssistant = async (
		status: "streaming" | "completed",
		force = false
	): Promise<void> => {
		const pendingLength = state.fullText.length;
		const pendingReasoningLength = state.reasoningText.length;
		const delta = pendingLength - lastPersistedLength;
		const reasoningDelta = pendingReasoningLength - lastPersistedReasoningLength;

		// Skip if no meaningful change (unless forced)
		if (!force && status === "streaming") {
			if (delta <= 0 && reasoningDelta <= 0) return;
			if (delta < minCharsPerFlush && reasoningDelta < minCharsPerFlush) return;
		}
		if (delta <= 0 && reasoningDelta <= 0 && !force) {
			return;
		}

		lastPersistedLength = pendingLength;
		lastPersistedReasoningLength = pendingReasoningLength;

		// Only send reasoning if it's non-empty
		const reasoningToSend =
			state.reasoningText.length > 0 ? state.reasoningText : undefined;

		// Calculate thinking time duration
		const thinkingTimeMs =
			state.reasoningStartTime && state.reasoningEndTime
				? state.reasoningEndTime - state.reasoningStartTime
				: undefined;

		if (status === "completed") {
			logger.debug("Final save - Reasoning status", {
				textLength: state.fullText.length,
				reasoningLength: reasoningToSend ? reasoningToSend.length : 0,
				hasReasoning: !!reasoningToSend,
				thinkingTimeMs,
				thinkingTimeSec: thinkingTimeMs ? (thinkingTimeMs / 1000).toFixed(1) : 0,
				reasoningPreview: reasoningToSend ? reasoningToSend.slice(0, 100) : "NONE",
			});
		}

		const response = await persistMessage({
			userId,
			chatId,
			clientMessageId: assistantMessageId,
			role: "assistant",
			content: state.fullText,
			reasoning: reasoningToSend,
			thinkingTimeMs,
			createdAt: assistantCreatedAtIso,
			status,
		});

		if (!response.ok) {
			throw new Error("assistant streamUpsert rejected");
		}
	};

	/**
	 * Schedule a debounced flush of accumulated content
	 */
	const scheduleFlush = (): Promise<void> => {
		if (flushTimeout) return pendingFlush ?? Promise.resolve();

		const promise = new Promise<void>((resolve) => {
			pendingResolve = resolve;
		});
		pendingFlush = promise;

		flushTimeout = setTimeout(async () => {
			flushTimeout = null;
			try {
				await persistAssistant("streaming");
			} catch (error: unknown) {
				logger.error("Failed to persist assistant chunk", error);
				if (!persistenceError) {
					persistenceError =
						error instanceof Error
							? error
							: new Error("Failed to persist assistant chunk");
				}
			} finally {
				pendingResolve?.();
				pendingResolve = null;
				pendingFlush = null;
			}
		}, flushIntervalMs);

		return promise;
	};

	/**
	 * Finalize the stream and persist final state
	 */
	const finalize = async (): Promise<void> => {
		if (finalized) return;
		finalized = true;
		state.isFinished = true;

		// Clear pending timeout
		if (flushTimeout) {
			clearTimeout(flushTimeout);
			flushTimeout = null;
		}

		// Resolve any pending flush
		const pending = pendingFlush;
		if (pendingResolve) {
			pendingResolve();
			pendingResolve = null;
		}
		pendingFlush = null;

		// Wait for pending flush to complete
		if (pending) {
			try {
				await pending;
			} catch (error: unknown) {
				logger.error("Failed to await pending flush during finalize", error);
			}
		}

		// Persist final state
		try {
			await persistAssistant("completed", true);
		} catch (error: unknown) {
			logger.error("Failed to persist assistant completion", error);
			if (!persistenceError) {
				persistenceError =
					error instanceof Error
						? error
						: new Error("Failed to persist assistant completion");
			}
		}

		if (persistenceError) {
			throw persistenceError;
		}
	};

	return {
		get state() {
			return state;
		},

		appendText(text: string): void {
			state.fullText += text;
		},

		appendReasoning(text: string): void {
			// Start timer on FIRST reasoning chunk
			if (!state.reasoningStartTime) {
				state.reasoningStartTime = Date.now();
				logger.debug("Reasoning started", { startTime: state.reasoningStartTime });
			}

			if (text.length > 0) {
				state.reasoningText += text;
				// Update end time on EVERY chunk (captures last one)
				state.reasoningEndTime = Date.now();
			}
		},

		scheduleFlush,
		finalize,

		getPersistenceError(): Error | null {
			return persistenceError;
		},

		markAborted(): void {
			state.status = "aborted";
		},

		markError(): void {
			state.status = "error";
		},
	};
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Default headers for streaming responses
 */
export const STREAMING_RESPONSE_HEADERS: HeadersInit = {
	"Cache-Control": "no-store, max-age=0",
	"X-Accel-Buffering": "no",
	Connection: "keep-alive",
};

/**
 * Create headers for a streaming response
 *
 * @param baseHeaders - Headers from the AI SDK response
 * @param additionalHeaders - Additional headers to merge (e.g., CORS)
 * @returns Merged headers object
 */
export function createStreamingHeaders(
	baseHeaders?: Headers,
	additionalHeaders?: Headers
): Headers {
	const headers = new Headers(baseHeaders);

	// Add streaming-specific headers
	for (const [key, value] of Object.entries(STREAMING_RESPONSE_HEADERS)) {
		headers.set(key, value);
	}

	// Merge additional headers
	if (additionalHeaders) {
		additionalHeaders.forEach((value, key) => {
			headers.set(key, value);
		});
	}

	return headers;
}

// ============================================================================
// Exports for testing
// ============================================================================

export const _internal = {
	STREAM_FLUSH_INTERVAL_MS,
	STREAM_MIN_CHARS_PER_FLUSH,
};
