/**
 * Request validation logic for chat handler
 * Handles all input validation, sanitization, and security checks
 */

import type { AnyUIMessage, ChatRequestPayload } from "./chat-handler-types";
import { isTextPart, isFilePart } from "@/lib/error-handling";
import {
	MAX_USER_PART_CHARS,
	MAX_MESSAGES_PER_REQUEST,
	MAX_REQUEST_BODY_SIZE,
	MAX_ATTACHMENT_SIZE,
	MAX_MESSAGE_CONTENT_LENGTH,
} from "@/config/constants";

/**
 * Result of request body size validation
 */
export interface BodySizeValidation {
	valid: boolean;
	error?: string;
	size?: number;
}

/**
 * Validate request body size before loading into memory
 */
export function validateRequestBodySize(request: Request): BodySizeValidation {
	const contentLength = request.headers.get("content-length");
	if (!contentLength) {
		return { valid: true };
	}

	const declaredSize = Number.parseInt(contentLength, 10);
	if (Number.isNaN(declaredSize)) {
		return { valid: true };
	}

	if (declaredSize > MAX_REQUEST_BODY_SIZE) {
		return {
			valid: false,
			error: `Request body too large: ${declaredSize} bytes (max: ${MAX_REQUEST_BODY_SIZE} bytes)`,
			size: declaredSize,
		};
	}

	return { valid: true };
}

/**
 * Validate actual body size after loading
 */
export function validateActualBodySize(body: string): BodySizeValidation {
	const bodySize = new TextEncoder().encode(body).length;
	if (bodySize > MAX_REQUEST_BODY_SIZE) {
		return {
			valid: false,
			error: `Request body too large: ${bodySize} bytes (max: ${MAX_REQUEST_BODY_SIZE} bytes)`,
			size: bodySize,
		};
	}
	return { valid: true };
}

/**
 * Validate messages array length
 */
export function validateMessagesLength(messages: AnyUIMessage[]): { valid: boolean; error?: string } {
	if (messages.length > MAX_MESSAGES_PER_REQUEST) {
		return {
			valid: false,
			error: `Too many messages: ${messages.length} (max: ${MAX_MESSAGES_PER_REQUEST})`,
		};
	}
	return { valid: true };
}

/**
 * Result of message content validation
 */
export interface MessageContentValidation {
	valid: boolean;
	error?: string;
	messageIndex?: number;
}

/**
 * Validate message content length and attachment sizes
 */
export function validateMessageContent(messages: AnyUIMessage[]): MessageContentValidation {
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (!message) continue;

		// Check each part of the message
		for (const part of message.parts ?? []) {
			if (!part) continue;

			// Validate text content length
			if (isTextPart(part)) {
				const textLength = part.text.length;
				if (textLength > MAX_MESSAGE_CONTENT_LENGTH) {
					return {
						valid: false,
						error: `Message content too long: ${textLength} characters (max: ${MAX_MESSAGE_CONTENT_LENGTH})`,
						messageIndex: i,
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
						valid: false,
						error: `Attachment too large: ${totalAttachmentSize} bytes (max: ${MAX_ATTACHMENT_SIZE} bytes)`,
						messageIndex: i,
					};
				}
			}
		}
	}

	return { valid: true };
}

/**
 * Clamp user message text to max length
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
			const name = part.filename && part.filename.length > 0 ? part.filename : "attachment";
			const media = part.mediaType && part.mediaType.length > 0 ? ` (${part.mediaType})` : "";
			segments.push(`[Attachment: ${name}${media}]`);
			continue;
		}
	}
	return segments.join("");
}

/**
 * Validate chat ID from payload
 */
export function validateChatId(payload: ChatRequestPayload): { valid: boolean; chatId?: string; error?: string } {
	const chatId = typeof payload?.chatId === "string" && payload.chatId.trim().length > 0 ? payload.chatId.trim() : null;
	if (!chatId) {
		return { valid: false, error: "Missing chatId" };
	}
	return { valid: true, chatId };
}

/**
 * Validate messages array from payload
 */
export function validateMessages(payload: ChatRequestPayload): {
	valid: boolean;
	messages?: AnyUIMessage[];
	error?: string;
} {
	const rawMessages: AnyUIMessage[] = Array.isArray(payload?.messages) ? payload.messages : [];
	if (rawMessages.length === 0) {
		return { valid: false, error: "Missing chat messages" };
	}
	return { valid: true, messages: rawMessages };
}

/**
 * Find the last user message in the messages array
 */
export function findLastUserMessage(messages: AnyUIMessage[]): {
	found: boolean;
	message?: AnyUIMessage;
	index?: number;
	error?: string;
} {
	const userMessageIndex = [...messages].reverse().findIndex((msg) => msg.role === "user");
	if (userMessageIndex === -1) {
		return { found: false, error: "Missing user message" };
	}
	const normalizedIndex = messages.length - 1 - userMessageIndex;
	return {
		found: true,
		message: messages[normalizedIndex],
		index: normalizedIndex,
	};
}
