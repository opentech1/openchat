/**
 * Convex Server Constants Configuration
 *
 * Centralized configuration for all Convex backend constants.
 * These values control file uploads, message limits, and rate limiting on the server side.
 *
 * @example
 * ```ts
 * import { FILE_LIMITS, CHAT_LIMITS } from './config/constants';
 * if (fileSize > FILE_LIMITS.MAX_IMAGE_SIZE) { ... }
 * ```
 */

/**
 * File Upload Size Limits (in bytes)
 * Controls maximum file sizes for different media types
 */
export const FILE_LIMITS = {
	/** Default maximum file size for unknown types (10MB) */
	MAX_FILE_SIZE: 10 * 1024 * 1024,

	/** Maximum size for image files (10MB) */
	MAX_IMAGE_SIZE: 10 * 1024 * 1024,

	/** Maximum size for document files (10MB) */
	MAX_DOCUMENT_SIZE: 10 * 1024 * 1024,

	/** Maximum size for audio files (25MB) */
	MAX_AUDIO_SIZE: 25 * 1024 * 1024,

	/** Maximum size for video files (50MB) */
	MAX_VIDEO_SIZE: 50 * 1024 * 1024,
} as const;

/**
 * User Quota Limits
 * Controls per-user resource limits
 */
export const USER_LIMITS = {
	/** Maximum number of files a user can upload */
	MAX_FILES_PER_USER: 150,
} as const;

/**
 * Allowed File Types
 * MIME types permitted for upload
 */
export const ALLOWED_FILE_TYPES = {
	/** Permitted image MIME types */
	IMAGES: [
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/svg+xml",
		"image/bmp",
	] as const,

	/** Permitted document MIME types */
	DOCUMENTS: [
		"application/pdf",
		"text/plain",
		"text/markdown",
	] as const,

	/** Permitted audio MIME types */
	AUDIO: [
		"audio/mpeg",
		"audio/mp3",
		"audio/wav",
		"audio/ogg",
		"audio/m4a",
		"audio/aac",
		"audio/webm",
	] as const,

	/** Permitted video MIME types */
	VIDEO: [
		"video/mp4",
		"video/mpeg",
		"video/quicktime",
		"video/webm",
		"video/x-msvideo",
		"video/x-ms-wmv",
	] as const,
} as const;

/**
 * Combined list of all allowed file types
 */
export const ALL_ALLOWED_TYPES = [
	...ALLOWED_FILE_TYPES.IMAGES,
	...ALLOWED_FILE_TYPES.DOCUMENTS,
	...ALLOWED_FILE_TYPES.AUDIO,
	...ALLOWED_FILE_TYPES.VIDEO,
] as const;

/**
 * Upload Rate Limiting
 * Controls how frequently users can upload files
 */
export const UPLOAD_RATE_LIMITS = {
	/** Rate limit window duration in milliseconds (1 minute) */
	WINDOW_MS: 60 * 1000,

	/** Maximum uploads allowed within the window */
	MAX_PER_WINDOW: 10,
} as const;

/**
 * Message Limits
 * Controls message content and chat size
 */
export const MESSAGE_LIMITS = {
	/** Maximum content length in bytes (100KB) */
	MAX_CONTENT_LENGTH: 100 * 1024,

	/** Maximum messages per chat to prevent DoS and database bloat */
	MAX_PER_CHAT: 10_000,

	/** Allowed message roles */
	ALLOWED_ROLES: ["user", "assistant"] as const,
} as const;

/**
 * Chat Configuration
 * Settings for chat management
 */
export const CHAT_LIMITS = {
	/** Maximum title length for chat titles */
	MAX_TITLE_LENGTH: 200,

	/** Security: Maximum chat list limit to prevent unbounded queries */
	MAX_LIST_LIMIT: 200,

	/** Default limit for chat list queries */
	DEFAULT_LIST_LIMIT: 50,
} as const;

/**
 * Filename Sanitization
 * Settings for filename security
 */
export const FILENAME_CONFIG = {
	/** Maximum filename length (common filesystem limit) */
	MAX_LENGTH: 255,

	/** Fallback name for invalid filenames */
	FALLBACK_NAME: "unnamed_file",
} as const;

/**
 * Type Guards and Validators
 */

/**
 * Check if a MIME type is an allowed image type
 */
export function isAllowedImageType(contentType: string): boolean {
	const normalized = contentType.toLowerCase().trim();
	return (ALLOWED_FILE_TYPES.IMAGES as readonly string[]).includes(normalized);
}

/**
 * Check if a MIME type is an allowed document type
 */
export function isAllowedDocumentType(contentType: string): boolean {
	const normalized = contentType.toLowerCase().trim();
	return (ALLOWED_FILE_TYPES.DOCUMENTS as readonly string[]).includes(normalized);
}

/**
 * Check if a MIME type is an allowed audio type
 */
export function isAllowedAudioType(contentType: string): boolean {
	const normalized = contentType.toLowerCase().trim();
	return (ALLOWED_FILE_TYPES.AUDIO as readonly string[]).includes(normalized);
}

/**
 * Check if a MIME type is an allowed video type
 */
export function isAllowedVideoType(contentType: string): boolean {
	const normalized = contentType.toLowerCase().trim();
	return (ALLOWED_FILE_TYPES.VIDEO as readonly string[]).includes(normalized);
}

/**
 * Check if a MIME type is allowed at all
 */
export function isAllowedFileType(contentType: string): boolean {
	const normalized = contentType.toLowerCase().trim();
	return (ALL_ALLOWED_TYPES as readonly string[]).includes(normalized);
}

/**
 * Get the maximum file size for a given content type
 * @param contentType - MIME type of the file
 * @returns Maximum allowed size in bytes
 */
export function getMaxFileSizeForType(contentType: string): number {
	if (isAllowedImageType(contentType)) return FILE_LIMITS.MAX_IMAGE_SIZE;
	if (isAllowedDocumentType(contentType)) return FILE_LIMITS.MAX_DOCUMENT_SIZE;
	if (isAllowedAudioType(contentType)) return FILE_LIMITS.MAX_AUDIO_SIZE;
	if (isAllowedVideoType(contentType)) return FILE_LIMITS.MAX_VIDEO_SIZE;
	return FILE_LIMITS.MAX_FILE_SIZE;
}

/**
 * Message role type
 */
export type MessageRole = typeof MESSAGE_LIMITS.ALLOWED_ROLES[number];

/**
 * Validate message role
 * @param role - Role to validate
 * @returns Validated role
 * @throws Error if role is invalid
 */
export function validateMessageRole(role: string): MessageRole {
	if (!MESSAGE_LIMITS.ALLOWED_ROLES.includes(role as MessageRole)) {
		throw new Error(
			`Invalid message role: "${role}". Only "user" and "assistant" are allowed.`,
		);
	}
	return role as MessageRole;
}
