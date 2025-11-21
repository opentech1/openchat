/**
 * Type definitions for the chat handler
 * Ensures type safety across all chat-related operations
 */

import type { UIMessage } from "ai";
import type { Id } from "@server/convex/_generated/dataModel";

/**
 * Extended UIMessage type that allows arbitrary metadata
 */
export type AnyUIMessage = UIMessage<Record<string, unknown>>;

/**
 * Metadata attached to user messages
 */
export interface MessageMetadata {
	/** ISO timestamp when the message was created */
	createdAt?: string | Date;
	/** Any additional custom metadata */
	[key: string]: unknown;
}

/**
 * UIMessage with typed ID and metadata fields
 */
export interface TypedUIMessage extends AnyUIMessage {
	/** Unique message identifier */
	id: string;
	/** Message metadata including creation timestamp */
	metadata?: MessageMetadata;
}

/**
 * Text chunk from stream response
 */
export interface TextStreamChunk {
	type: "text-delta";
	/** The text content of the chunk */
	text: string;
}

/**
 * Reasoning chunk from stream response (for reasoning-capable models)
 */
export interface ReasoningStreamChunk {
	type: "reasoning-delta";
	/** The reasoning text content */
	text: string;
}

/**
 * Union type for all possible stream chunk types
 */
export type StreamChunk = TextStreamChunk | ReasoningStreamChunk | { type: string; [key: string]: unknown };

/**
 * OpenRouter API error response
 */
export interface OpenRouterError extends Error {
	/** HTTP status code from OpenRouter API */
	statusCode?: number;
	/** Error code from OpenRouter */
	code?: string;
	/** Additional error metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Request for persisting a message to the database
 */
export interface StreamPersistRequest {
	/** User ID in Convex format */
	userId: string;
	/** Chat ID in Convex format */
	chatId: string;
	/** Client-side message ID for deduplication */
	clientMessageId?: string | null;
	/** Message role */
	role: "user" | "assistant";
	/** Message content text */
	content: string;
	/** Optional reasoning/thinking content (for reasoning models) */
	reasoning?: string;
	/** Time spent thinking in milliseconds (for reasoning models) */
	thinkingTimeMs?: number;
	/** ISO timestamp when message was created */
	createdAt: string;
	/** Message status */
	status: "streaming" | "completed";
	/** File attachments */
	attachments?: Array<{
		storageId: Id<"_storage">;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
		url?: string;
	}>;
}

/**
 * Request payload for chat API endpoint
 */
export interface ChatRequestPayload {
	/** Model identifier (e.g., "anthropic/claude-3-5-sonnet") */
	modelId?: string;
	/** OpenRouter API key */
	apiKey?: string;
	/** Chat conversation ID */
	chatId?: string;
	/** Array of conversation messages */
	messages?: AnyUIMessage[];
	/** Client-side assistant message ID */
	assistantMessageId?: string;
	/** File attachments to include with the last user message */
	attachments?: Array<{
		storageId: Id<"_storage">;
		filename: string;
		contentType: string;
		size: number;
		url?: string;
	}>;
	/** Configuration for reasoning/thinking features */
	reasoningConfig?: {
		/** Whether reasoning is enabled */
		enabled: boolean;
		/** Reasoning effort level (for OpenAI/Grok models) */
		effort?: "medium" | "high";
		/** Max reasoning tokens (for Anthropic/Gemini models) */
		max_tokens?: number;
		/** Whether to exclude reasoning from response */
		exclude?: boolean;
	};
}

/**
 * Type guard to check if an error is an OpenRouterError
 */
export function isOpenRouterError(error: unknown): error is OpenRouterError {
	return (
		error instanceof Error &&
		"statusCode" in error &&
		typeof (error as OpenRouterError).statusCode === "number"
	);
}

/**
 * Type guard to check if a chunk is a text stream chunk
 */
export function isTextStreamChunk(chunk: unknown): chunk is TextStreamChunk {
	return (
		typeof chunk === "object" &&
		chunk !== null &&
		"type" in chunk &&
		chunk.type === "text-delta" &&
		"text" in chunk &&
		typeof (chunk as TextStreamChunk).text === "string"
	);
}

/**
 * Type guard to check if a chunk is a reasoning stream chunk
 */
export function isReasoningStreamChunk(chunk: unknown): chunk is ReasoningStreamChunk {
	return (
		typeof chunk === "object" &&
		chunk !== null &&
		"type" in chunk &&
		chunk.type === "reasoning-delta" &&
		"text" in chunk &&
		typeof (chunk as ReasoningStreamChunk).text === "string"
	);
}

/**
 * Type guard to check if a message has typed metadata
 */
export function hasTypedMetadata(message: AnyUIMessage): message is TypedUIMessage {
	return "metadata" in message && typeof message.metadata === "object";
}

/**
 * Safely extract message ID from a UIMessage
 */
export function getMessageId(message: AnyUIMessage): string {
	if (typeof message.id === "string" && message.id.length > 0) {
		return message.id;
	}
	return crypto.randomUUID?.() ?? `msg-${Date.now()}`;
}

/**
 * Safely extract creation timestamp from message metadata
 */
export function getMessageCreatedAt(message: AnyUIMessage): string {
	if (hasTypedMetadata(message) && message.metadata?.createdAt) {
		const date = new Date(message.metadata.createdAt);
		if (!Number.isNaN(date.valueOf())) {
			return date.toISOString();
		}
	}
	return new Date().toISOString();
}
