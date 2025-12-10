/**
 * Chat attachment processing utilities
 *
 * This module handles validation and processing of file attachments
 * for chat messages, including size validation, type validation,
 * and conversion to AI SDK format.
 */

import type { Id } from "@server/convex/_generated/dataModel";
import { isFilePart } from "@/lib/error-handling";
import {
	MAX_ATTACHMENT_SIZE,
	MAX_ATTACHMENTS,
	MAX_TOTAL_ATTACHMENT_SIZE,
} from "./config";

// ============================================================================
// Types
// ============================================================================

/**
 * Attachment from the chat request payload
 */
export interface ChatAttachment {
	/** Convex storage ID for the uploaded file */
	storageId: Id<"_storage">;
	/** Original filename */
	filename: string;
	/** MIME type of the file */
	contentType: string;
	/** File size in bytes */
	size: number;
	/** Optional pre-signed URL (may be provided client-side) */
	url?: string;
}

/**
 * Attachment ready for persistence in the database
 */
export interface PersistableAttachment {
	storageId: Id<"_storage">;
	filename: string;
	contentType: string;
	size: number;
	uploadedAt: number;
	url?: string;
}

/**
 * File part in AI SDK format for sending to the model
 */
export interface AIFilePart {
	type: "file";
	mediaType: string;
	url: string;
	filename: string;
}

/**
 * Result of attachment validation
 */
export interface AttachmentValidationResult {
	isValid: boolean;
	errors: string[];
}

/**
 * File part from message for validation
 */
export interface MessageFilePart {
	type: "file";
	data?: string;
	url?: string;
	filename?: string;
	mediaType?: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates an array of attachments for count, size, and type constraints
 *
 * @param attachments - Array of attachments to validate
 * @returns Validation result with errors array
 *
 * @example
 * ```typescript
 * const result = validateAttachments(attachments);
 * if (!result.isValid) {
 *   return new Response(result.errors.join(", "), { status: 400 });
 * }
 * ```
 */
export function validateAttachments(
	attachments: ChatAttachment[]
): AttachmentValidationResult {
	const errors: string[] = [];

	// Check attachment count
	if (attachments.length > MAX_ATTACHMENTS) {
		errors.push(
			`Too many attachments: ${attachments.length} (max: ${MAX_ATTACHMENTS})`
		);
	}

	// Check individual and total sizes
	let totalSize = 0;
	for (let i = 0; i < attachments.length; i++) {
		const attachment = attachments[i];
		if (!attachment) continue;

		// Validate individual file size
		if (attachment.size > MAX_ATTACHMENT_SIZE) {
			errors.push(
				`Attachment "${attachment.filename}" is too large: ${formatBytes(attachment.size)} (max: ${formatBytes(MAX_ATTACHMENT_SIZE)})`
			);
		}

		totalSize += attachment.size;
	}

	// Validate total size
	if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
		errors.push(
			`Total attachment size too large: ${formatBytes(totalSize)} (max: ${formatBytes(MAX_TOTAL_ATTACHMENT_SIZE)})`
		);
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Validates a file part from a message for size constraints
 *
 * This checks the combined size of data URL and url fields to prevent
 * bypass by splitting content across fields.
 *
 * @param part - File part to validate
 * @returns Validation result with errors array
 */
export function validateFilePart(
	part: MessageFilePart
): AttachmentValidationResult {
	const errors: string[] = [];
	let totalSize = 0;

	// Add data URL size if present
	if (typeof part.data === "string") {
		totalSize += new TextEncoder().encode(part.data).length;
	}

	// Add url content size if it's a data URL
	if (typeof part.url === "string" && part.url.startsWith("data:")) {
		totalSize += new TextEncoder().encode(part.url).length;
	}

	// Check combined size to prevent bypass by splitting content
	if (totalSize > MAX_ATTACHMENT_SIZE) {
		const filename = part.filename || "attachment";
		errors.push(
			`Attachment "${filename}" too large: ${formatBytes(totalSize)} (max: ${formatBytes(MAX_ATTACHMENT_SIZE)})`
		);
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Validates all file parts in message parts array
 *
 * @param parts - Array of message parts to validate
 * @returns Validation result with all errors
 */
export function validateMessageFileParts(
	parts: unknown[]
): AttachmentValidationResult {
	const errors: string[] = [];

	for (const part of parts) {
		if (!part) continue;

		if (isFilePart(part)) {
			const result = validateFilePart(part as MessageFilePart);
			errors.push(...result.errors);
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

// ============================================================================
// Processing Functions
// ============================================================================

/**
 * Converts chat attachments to AI SDK file parts
 *
 * Fetches URLs for each attachment using the provided getFileUrl function
 * and converts them to the format expected by the AI SDK.
 *
 * @param attachments - Array of chat attachments to process
 * @param getFileUrl - Function to fetch the URL for a storage ID
 * @returns Array of AI file parts ready for the model
 *
 * @throws Error if URL cannot be fetched for any attachment
 *
 * @example
 * ```typescript
 * const fileParts = await processAttachments(attachments, async (storageId) => {
 *   return await getFileUrl(storageId, userId);
 * });
 * ```
 */
export async function processAttachments(
	attachments: ChatAttachment[],
	getFileUrl: (storageId: Id<"_storage">) => Promise<string | null>
): Promise<AIFilePart[]> {
	if (!attachments || attachments.length === 0) {
		return [];
	}

	const fileParts = await Promise.all(
		attachments.map(async (attachment) => {
			const url = await getFileUrl(attachment.storageId);

			if (!url) {
				throw new Error(`Failed to get URL for file: ${attachment.filename}`);
			}

			return {
				type: "file" as const,
				mediaType: attachment.contentType,
				url,
				filename: attachment.filename,
			};
		})
	);

	return fileParts;
}

/**
 * Converts chat attachments to persistable format
 *
 * Transforms attachments from request payload format to the format
 * expected by the database persistence layer.
 *
 * @param attachments - Array of chat attachments
 * @param storageIdConverter - Function to convert storage ID to the correct type
 * @returns Array of persistable attachments
 */
export function toPersistableAttachments<T>(
	attachments: ChatAttachment[] | undefined,
	storageIdConverter: (id: Id<"_storage">) => T
): Array<{
	storageId: T;
	filename: string;
	contentType: string;
	size: number;
	uploadedAt: number;
}> | undefined {
	if (!attachments || attachments.length === 0) {
		return undefined;
	}

	return attachments.map((a) => ({
		storageId: storageIdConverter(a.storageId),
		filename: a.filename,
		contentType: a.contentType,
		size: a.size,
		uploadedAt: Date.now(),
	}));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats bytes to a human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "5.2 MB")
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Normalizes MIME type to a standard format
 *
 * Handles edge cases and provides fallbacks for unknown types.
 *
 * @param contentType - Original content type
 * @returns Normalized MIME type
 */
export function normalizeMimeType(contentType: string): string {
	if (!contentType || contentType.trim() === "") {
		return "application/octet-stream";
	}

	// Extract just the MIME type, removing any parameters (e.g., charset)
	const mimeType = contentType.split(";")[0]?.trim().toLowerCase();

	if (!mimeType) {
		return "application/octet-stream";
	}

	return mimeType;
}

/**
 * Determines if a content type is an image
 *
 * @param contentType - MIME type to check
 * @returns True if the content type is an image
 */
export function isImageType(contentType: string): boolean {
	const normalized = normalizeMimeType(contentType);
	return normalized.startsWith("image/");
}

/**
 * Determines if a content type is a document
 *
 * @param contentType - MIME type to check
 * @returns True if the content type is a document (PDF, Word, etc.)
 */
export function isDocumentType(contentType: string): boolean {
	const normalized = normalizeMimeType(contentType);
	const documentTypes = [
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.ms-powerpoint",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"text/plain",
		"text/csv",
		"text/markdown",
	];
	return documentTypes.includes(normalized);
}

/**
 * Determines if a content type is code
 *
 * @param contentType - MIME type to check
 * @returns True if the content type represents code
 */
export function isCodeType(contentType: string): boolean {
	const normalized = normalizeMimeType(contentType);
	const codeTypes = [
		"text/javascript",
		"application/javascript",
		"text/typescript",
		"application/typescript",
		"text/x-python",
		"application/x-python",
		"text/x-java",
		"text/x-c",
		"text/x-c++",
		"text/x-go",
		"text/x-rust",
		"application/json",
		"text/html",
		"text/css",
		"text/xml",
		"application/xml",
	];
	return codeTypes.includes(normalized) || normalized.startsWith("text/x-");
}

/**
 * Gets a human-readable category for a content type
 *
 * @param contentType - MIME type to categorize
 * @returns Category name ("image", "document", "code", or "file")
 */
export function getAttachmentCategory(
	contentType: string
): "image" | "document" | "code" | "file" {
	if (isImageType(contentType)) return "image";
	if (isDocumentType(contentType)) return "document";
	if (isCodeType(contentType)) return "code";
	return "file";
}
