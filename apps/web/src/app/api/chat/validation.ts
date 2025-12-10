/**
 * Chat API request validation utilities
 *
 * This module contains all validation logic for the chat API including:
 * - Type guards for stream chunk types
 * - IP extraction and hashing for rate limiting
 * - Request body parsing and validation
 * - Error status code extraction
 * - Request size limit validation
 */
import { createHash } from "crypto";
import type { UIMessage } from "ai";
import { isTextPart, isFilePart } from "@/lib/error-handling";
import {
	MAX_MESSAGES_PER_REQUEST,
	MAX_REQUEST_BODY_SIZE,
	MAX_ATTACHMENT_SIZE,
	MAX_MESSAGE_CONTENT_LENGTH,
	MAX_USER_PART_CHARS,
} from "./config";

// ============================================================================
// Types
// ============================================================================

/**
 * Message metadata type with optional createdAt timestamp
 */
type MessageMetadata = {
	createdAt?: string | Date;
};

/**
 * UI message with metadata
 */
export type AnyUIMessage = UIMessage<MessageMetadata>;

/**
 * Result of request validation
 */
export interface ValidationResult {
	isValid: boolean;
	error?: string;
	statusCode?: number;
}

/**
 * Reasoning delta chunk with text content
 */
export interface ReasoningDeltaWithText {
	type: "reasoning-delta";
	text: string;
}

/**
 * Chat request payload structure
 */
export interface ChatRequestPayload {
	modelId?: string;
	apiKey?: string;
	chatId?: string;
	messages?: AnyUIMessage[];
	assistantMessageId?: string;
	attachments?: Array<{
		storageId: string;
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
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a chunk is a reasoning-delta with text
 *
 * @param chunk - Stream chunk to check
 * @returns True if chunk is a reasoning delta with text content
 *
 * @example
 * ```ts
 * if (isReasoningDeltaWithText(chunk)) {
 *   console.log(chunk.text); // TypeScript knows chunk.text exists
 * }
 * ```
 */
export function isReasoningDeltaWithText(
	chunk: { type: string }
): chunk is ReasoningDeltaWithText {
	return (
		chunk.type === "reasoning-delta" &&
		"text" in chunk &&
		typeof (chunk as { text?: unknown }).text === "string"
	);
}

// ============================================================================
// IP Extraction & Hashing
// ============================================================================

/**
 * Extract client IP address from request headers
 *
 * Checks the following sources in order:
 * 1. X-Forwarded-For header (first IP in chain)
 * 2. Request URL hostname
 * 3. Fallback to 127.0.0.1
 *
 * @param request - The incoming HTTP request
 * @returns The extracted client IP address
 *
 * @example
 * ```ts
 * const ip = extractClientIP(request);
 * // "203.0.113.195" or "127.0.0.1"
 * ```
 */
export function extractClientIP(request: Request): string {
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
 * Generate an anonymized hash of the client IP address
 *
 * Security strategy:
 * - Uses full SHA-256 hash (64 hex chars) for better anonymization
 * - One-way hash prevents reverse-lookup of original IP
 * - Allows correlation of requests from same IP without storing PII
 * - Sufficient for rate limiting and abuse detection
 *
 * @param ip - The client IP address to hash
 * @returns SHA-256 hash of the IP, or "unknown" if hashing fails
 *
 * @example
 * ```ts
 * const hash = generateClientHash("203.0.113.195");
 * // "a3f5b2c8d9e1f0a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6"
 * ```
 */
export function generateClientHash(ip: string): string {
	try {
		return createHash("sha256").update(ip).digest("hex");
	} catch {
		return "unknown";
	}
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Extract statusCode from an error object safely
 *
 * @param error - The error object to extract status code from
 * @returns The status code if present and valid, undefined otherwise
 *
 * @example
 * ```ts
 * const status = getErrorStatusCode(error);
 * if (status === 401) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 * ```
 */
export function getErrorStatusCode(error: unknown): number | undefined {
	if (error && typeof error === "object" && "statusCode" in error) {
		const statusCode = (error as { statusCode: unknown }).statusCode;
		return typeof statusCode === "number" ? statusCode : undefined;
	}
	return undefined;
}

// ============================================================================
// Request Body Validation
// ============================================================================

/**
 * Validate the Content-Length header against max body size
 *
 * @param request - The incoming HTTP request
 * @returns ValidationResult with isValid=false if body is too large
 *
 * @example
 * ```ts
 * const result = validateContentLength(request);
 * if (!result.isValid) {
 *   return new Response(result.error, { status: result.statusCode });
 * }
 * ```
 */
export function validateContentLength(request: Request): ValidationResult {
	const contentLength = request.headers.get("content-length");
	if (contentLength) {
		const declaredSize = Number.parseInt(contentLength, 10);
		if (!Number.isNaN(declaredSize) && declaredSize > MAX_REQUEST_BODY_SIZE) {
			return {
				isValid: false,
				error: `Request body too large: ${declaredSize} bytes (max: ${MAX_REQUEST_BODY_SIZE} bytes)`,
				statusCode: 413,
			};
		}
	}
	return { isValid: true };
}

/**
 * Validate the actual body size after reading
 *
 * @param bodySize - The actual body size in bytes
 * @returns ValidationResult with isValid=false if body is too large
 */
export function validateBodySize(bodySize: number): ValidationResult {
	if (bodySize > MAX_REQUEST_BODY_SIZE) {
		return {
			isValid: false,
			error: `Request body too large: ${bodySize} bytes (max: ${MAX_REQUEST_BODY_SIZE} bytes)`,
			statusCode: 413,
		};
	}
	return { isValid: true };
}

/**
 * Parse and validate JSON request body
 *
 * @param rawBody - The raw request body string
 * @returns Parsed payload or validation error
 */
export function parseRequestBody(rawBody: string): {
	payload?: ChatRequestPayload;
	error?: string;
	statusCode?: number;
} {
	try {
		const payload = JSON.parse(rawBody) as ChatRequestPayload;
		return { payload };
	} catch (error: unknown) {
		if (error instanceof SyntaxError) {
			return { error: "Invalid JSON payload", statusCode: 400 };
		}
		throw error;
	}
}

/**
 * Validate the chat ID field
 *
 * @param payload - The request payload
 * @returns ValidationResult with isValid=false if chatId is missing
 */
export function validateChatId(payload: ChatRequestPayload): ValidationResult {
	const chatId =
		typeof payload?.chatId === "string" && payload.chatId.trim().length > 0
			? payload.chatId.trim()
			: null;
	if (!chatId) {
		return {
			isValid: false,
			error: "Missing chatId",
			statusCode: 400,
		};
	}
	return { isValid: true };
}

/**
 * Validate messages array
 *
 * @param payload - The request payload
 * @returns ValidationResult with appropriate error if validation fails
 */
export function validateMessages(payload: ChatRequestPayload): ValidationResult {
	const messages: AnyUIMessage[] = Array.isArray(payload?.messages)
		? (payload.messages as AnyUIMessage[])
		: [];

	if (messages.length === 0) {
		return {
			isValid: false,
			error: "Missing chat messages",
			statusCode: 400,
		};
	}

	if (messages.length > MAX_MESSAGES_PER_REQUEST) {
		return {
			isValid: false,
			error: `Too many messages: ${messages.length} (max: ${MAX_MESSAGES_PER_REQUEST})`,
			statusCode: 413,
		};
	}

	// Check for at least one user message
	const hasUserMessage = messages.some((msg) => msg.role === "user");
	if (!hasUserMessage) {
		return {
			isValid: false,
			error: "Missing user message",
			statusCode: 400,
		};
	}

	return { isValid: true };
}

/**
 * Validate message content lengths and attachment sizes
 *
 * @param messages - Array of messages to validate
 * @returns ValidationResult with appropriate error if validation fails
 */
export function validateMessageContent(messages: AnyUIMessage[]): ValidationResult {
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (!message) continue;

		for (const part of message.parts ?? []) {
			if (!part) continue;

			// Validate text content length
			if (isTextPart(part)) {
				const textLength = part.text.length;
				if (textLength > MAX_MESSAGE_CONTENT_LENGTH) {
					return {
						isValid: false,
						error: `Message content too long: ${textLength} characters (max: ${MAX_MESSAGE_CONTENT_LENGTH})`,
						statusCode: 413,
					};
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
					return {
						isValid: false,
						error: `Attachment too large: ${totalAttachmentSize} bytes (max: ${MAX_ATTACHMENT_SIZE} bytes)`,
						statusCode: 413,
					};
				}
			}
		}
	}

	return { isValid: true };
}

/**
 * Validate model and API key from payload
 *
 * @param payload - The request payload
 * @returns Validation result with extracted values or error
 */
export function validateModelConfig(payload: ChatRequestPayload): {
	isValid: boolean;
	modelId?: string;
	apiKey?: string;
	error?: string;
	statusCode?: number;
} {
	const modelId =
		typeof payload?.modelId === "string" && payload.modelId.trim().length > 0
			? payload.modelId.trim()
			: null;

	const apiKey =
		typeof payload?.apiKey === "string" && payload.apiKey.trim().length > 0
			? payload.apiKey.trim()
			: null;

	return {
		isValid: true,
		modelId: modelId ?? undefined,
		apiKey: apiKey ?? undefined,
	};
}

/**
 * Comprehensive chat request validation
 *
 * Validates all aspects of a chat request including:
 * - Chat ID presence
 * - Messages array validity
 * - Message content lengths
 * - Attachment sizes
 *
 * @param payload - The parsed request payload
 * @returns ValidationResult with first encountered error
 *
 * @example
 * ```ts
 * const result = validateChatRequest(payload);
 * if (!result.isValid) {
 *   return new Response(result.error, { status: result.statusCode });
 * }
 * ```
 */
export function validateChatRequest(payload: ChatRequestPayload): ValidationResult {
	// Validate chatId
	const chatIdResult = validateChatId(payload);
	if (!chatIdResult.isValid) return chatIdResult;

	// Validate messages
	const messagesResult = validateMessages(payload);
	if (!messagesResult.isValid) return messagesResult;

	// Validate message content
	const messages: AnyUIMessage[] = Array.isArray(payload?.messages)
		? (payload.messages as AnyUIMessage[])
		: [];
	const contentResult = validateMessageContent(messages);
	if (!contentResult.isValid) return contentResult;

	return { isValid: true };
}

// ============================================================================
// Message Processing Utilities
// ============================================================================

/**
 * Clamp user message text to maximum allowed length
 *
 * Truncates text parts of user messages to stay within MAX_USER_PART_CHARS limit.
 * Non-user messages and non-text parts are passed through unchanged.
 *
 * @param message - The message to clamp
 * @returns Message with clamped text parts
 */
export function clampUserText(message: AnyUIMessage): AnyUIMessage {
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

/**
 * Extract text content from a message
 *
 * Combines all text parts and creates placeholder text for file attachments.
 *
 * @param message - The message to extract text from
 * @returns Combined text content
 */
export function extractMessageText(message: AnyUIMessage): string {
	const segments: string[] = [];
	for (const part of message.parts ?? []) {
		if (!part) continue;
		if (isTextPart(part)) {
			segments.push(part.text);
			continue;
		}
		if (isFilePart(part)) {
			const name =
				part.filename && part.filename.length > 0 ? part.filename : "attachment";
			const media =
				part.mediaType && part.mediaType.length > 0 ? ` (${part.mediaType})` : "";
			segments.push(`[Attachment: ${name}${media}]`);
			continue;
		}
	}
	return segments.join("");
}

/**
 * Coerce a value to an ISO date string
 *
 * @param value - Value to coerce (string, Date, or other)
 * @returns ISO date string, defaulting to current time if invalid
 */
export function coerceIsoDate(value: unknown): string {
	if (typeof value === "string" && value.length > 0) {
		const date = new Date(value);
		if (!Number.isNaN(date.valueOf())) return date.toISOString();
	}
	if (value instanceof Date && !Number.isNaN(value.valueOf())) {
		return value.toISOString();
	}
	return new Date().toISOString();
}
