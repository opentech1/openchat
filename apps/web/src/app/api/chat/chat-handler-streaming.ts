/**
 * Streaming logic for chat handler
 * Handles stream processing, buffering, and chunk management
 */

import type { StreamPersistRequest, StreamChunk, isReasoningStreamChunk } from "./chat-handler-types";
import { STREAM_FLUSH_INTERVAL_MS, STREAM_MIN_CHARS_PER_FLUSH } from "@/config/constants";
import { createLogger } from "@/lib/logger";

const logger = createLogger("StreamHandler");

/**
 * Stream state management
 */
export interface StreamState {
	/** Accumulated assistant response text */
	assistantText: string;
	/** Accumulated reasoning/thinking text */
	assistantReasoning: string;
	/** Last persisted text length */
	lastPersistedLength: number;
	/** Last persisted reasoning length */
	lastPersistedReasoningLength: number;
	/** Current flush timeout */
	flushTimeout: ReturnType<typeof setTimeout> | null;
	/** Pending flush promise */
	pendingFlush: Promise<void> | null;
	/** Pending flush resolve function */
	pendingResolve: (() => void) | null;
	/** Whether stream has been finalized */
	finalized: boolean;
	/** Any persistence error that occurred */
	persistenceError: Error | null;
	/** When the stream started */
	startedAt: number;
	/** Stream completion status */
	streamStatus: "completed" | "aborted" | "error";
	/** When reasoning started (first reasoning chunk) */
	reasoningStartTime: number | null;
	/** When reasoning ended (last reasoning chunk) */
	reasoningEndTime: number | null;
}

/**
 * Create initial stream state
 */
export function createStreamState(): StreamState {
	return {
		assistantText: "",
		assistantReasoning: "",
		lastPersistedLength: 0,
		lastPersistedReasoningLength: 0,
		flushTimeout: null,
		pendingFlush: null,
		pendingResolve: null,
		finalized: false,
		persistenceError: null,
		startedAt: Date.now(),
		streamStatus: "completed",
		reasoningStartTime: null,
		reasoningEndTime: null,
	};
}

/**
 * Options for stream manager
 */
export interface StreamManagerOptions {
	/** Function to persist message updates */
	persistMessage: (input: StreamPersistRequest) => Promise<{ ok: boolean }>;
	/** User ID */
	userId: string;
	/** Chat ID */
	chatId: string;
	/** Assistant message ID */
	assistantMessageId: string;
	/** Assistant message creation timestamp */
	assistantCreatedAtIso: string;
}

/**
 * Stream manager handles buffering and persistence of streaming responses
 */
export class StreamManager {
	private state: StreamState;
	private options: StreamManagerOptions;

	constructor(options: StreamManagerOptions) {
		this.options = options;
		this.state = createStreamState();
	}

	/**
	 * Get current stream state (read-only)
	 */
	getState(): Readonly<StreamState> {
		return this.state;
	}

	/**
	 * Process a text chunk from the stream
	 */
	async handleTextChunk(text: string): Promise<void> {
		if (text.length === 0) return;
		this.state.assistantText += text;
		await this.scheduleFlush();
	}

	/**
	 * Process a reasoning chunk from the stream
	 */
	async handleReasoningChunk(text: string): Promise<void> {
		if (text.length === 0) return;

		// Start timer on FIRST reasoning chunk if not started
		if (!this.state.reasoningStartTime) {
			this.state.reasoningStartTime = Date.now();
			logger.debug("Reasoning started", { startTime: this.state.reasoningStartTime });
		}

		this.state.assistantReasoning += text;
		// Update end time on EVERY chunk (captures last one)
		this.state.reasoningEndTime = Date.now();
		await this.scheduleFlush();
	}

	/**
	 * Persist current assistant message state
	 */
	private async persistAssistant(status: "streaming" | "completed", force = false): Promise<void> {
		const pendingLength = this.state.assistantText.length;
		const pendingReasoningLength = this.state.assistantReasoning.length;
		const delta = pendingLength - this.state.lastPersistedLength;
		const reasoningDelta = pendingReasoningLength - this.state.lastPersistedReasoningLength;

		if (!force && status === "streaming") {
			if (delta <= 0 && reasoningDelta <= 0) return;
			if (delta < STREAM_MIN_CHARS_PER_FLUSH && reasoningDelta < STREAM_MIN_CHARS_PER_FLUSH) return;
		}

		if (delta <= 0 && reasoningDelta <= 0 && !force) {
			return;
		}

		this.state.lastPersistedLength = pendingLength;
		this.state.lastPersistedReasoningLength = pendingReasoningLength;

		// CRITICAL: Only send reasoning if it's non-empty
		const reasoningToSend = this.state.assistantReasoning.length > 0 ? this.state.assistantReasoning : undefined;

		// Calculate thinking time duration
		const thinkingTimeMs =
			this.state.reasoningStartTime && this.state.reasoningEndTime
				? this.state.reasoningEndTime - this.state.reasoningStartTime
				: undefined;

		if (status === "completed") {
			logger.debug("Final save - Reasoning status", {
				textLength: this.state.assistantText.length,
				reasoningLength: reasoningToSend ? reasoningToSend.length : 0,
				hasReasoning: !!reasoningToSend,
				thinkingTimeMs,
				thinkingTimeSec: thinkingTimeMs ? (thinkingTimeMs / 1000).toFixed(1) : 0,
				reasoningPreview: reasoningToSend ? reasoningToSend.slice(0, 100) : "NONE",
			});
		}

		const response = await this.options.persistMessage({
			userId: this.options.userId,
			chatId: this.options.chatId,
			clientMessageId: this.options.assistantMessageId,
			role: "assistant",
			content: this.state.assistantText,
			reasoning: reasoningToSend,
			thinkingTimeMs,
			createdAt: this.options.assistantCreatedAtIso,
			status,
		});

		if (!response.ok) {
			throw new Error("assistant streamUpsert rejected");
		}
	}

	/**
	 * Schedule a flush to persist buffered content
	 */
	private async scheduleFlush(): Promise<void> {
		if (this.state.flushTimeout) {
			return this.state.pendingFlush ?? Promise.resolve();
		}

		const promise = new Promise<void>((resolve) => {
			this.state.pendingResolve = resolve;
		});
		this.state.pendingFlush = promise;

		this.state.flushTimeout = setTimeout(async () => {
			this.state.flushTimeout = null;
			try {
				await this.persistAssistant("streaming");
			} catch (error) {
				logger.error("Failed to persist assistant chunk", error);
				if (!this.state.persistenceError) {
					this.state.persistenceError = error instanceof Error ? error : new Error("Failed to persist assistant chunk");
				}
			} finally {
				this.state.pendingResolve?.();
				this.state.pendingResolve = null;
				this.state.pendingFlush = null;
			}
		}, STREAM_FLUSH_INTERVAL_MS);

		return promise;
	}

	/**
	 * Finalize the stream and persist final state
	 */
	async finalize(): Promise<void> {
		if (this.state.finalized) return;
		this.state.finalized = true;

		if (this.state.flushTimeout) {
			clearTimeout(this.state.flushTimeout);
			this.state.flushTimeout = null;
		}

		const pending = this.state.pendingFlush;
		if (this.state.pendingResolve) {
			this.state.pendingResolve();
			this.state.pendingResolve = null;
		}
		this.state.pendingFlush = null;

		if (pending) {
			try {
				await pending;
			} catch {
				// ignore
			}
		}

		try {
			await this.persistAssistant("completed", true);
		} catch (error) {
			logger.error("Failed to persist assistant completion", error);
			if (!this.state.persistenceError) {
				this.state.persistenceError = error instanceof Error ? error : new Error("Failed to persist assistant completion");
			}
		}

		if (this.state.persistenceError) {
			throw this.state.persistenceError;
		}
	}

	/**
	 * Set stream completion status
	 */
	setStatus(status: "completed" | "aborted" | "error"): void {
		this.state.streamStatus = status;
	}

	/**
	 * Ensure reasoning end time is set if we have reasoning content
	 */
	ensureReasoningEndTime(): void {
		if (this.state.assistantReasoning.length > 0 && !this.state.reasoningEndTime) {
			this.state.reasoningEndTime = Date.now();
		}
	}

	/**
	 * Get stream duration in milliseconds
	 */
	getDuration(): number {
		return Date.now() - this.state.startedAt;
	}

	/**
	 * Get thinking duration in milliseconds (if reasoning occurred)
	 */
	getThinkingDuration(): number {
		if (this.state.reasoningStartTime && this.state.reasoningEndTime) {
			return this.state.reasoningEndTime - this.state.reasoningStartTime;
		}
		return 0;
	}
}
