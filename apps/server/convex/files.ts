import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Constants & Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes (default)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_USER_FILES = 150; // Quota per user

const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/jpg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"image/bmp",
] as const;

const ALLOWED_DOCUMENT_TYPES = [
	"application/pdf",
	"text/plain",
	"text/markdown",
] as const;

const ALLOWED_AUDIO_TYPES = [
	"audio/mpeg",
	"audio/mp3",
	"audio/wav",
	"audio/ogg",
	"audio/m4a",
	"audio/aac",
	"audio/webm",
] as const;

const ALLOWED_VIDEO_TYPES = [
	"video/mp4",
	"video/mpeg",
	"video/quicktime",
	"video/webm",
	"video/x-msvideo",
	"video/x-ms-wmv",
] as const;

const ALLOWED_TYPES = [
	...ALLOWED_IMAGE_TYPES,
	...ALLOWED_DOCUMENT_TYPES,
	...ALLOWED_AUDIO_TYPES,
	...ALLOWED_VIDEO_TYPES,
] as const;

const UPLOAD_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_UPLOADS_PER_WINDOW = 10;

// Helper Functions

/**
 * Sanitizes a filename by removing path components, dangerous characters, and limiting length.
 * @param filename - The original filename
 * @returns The sanitized filename
 */
function sanitizeFilename(filename: string): string {
	// Remove any path components (handle both forward and backslashes)
	let sanitized = filename.replace(/^.*[\\\/]/, "");

	// Remove dangerous characters (null bytes, control chars, etc.)
	sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, "");

	// Remove or replace potentially dangerous characters
	sanitized = sanitized.replace(/[<>:"|?*]/g, "_");

	// Trim whitespace
	sanitized = sanitized.trim();

	// Limit length to 255 characters (common filesystem limit)
	if (sanitized.length > 255) {
		// Preserve the file extension if possible
		const lastDot = sanitized.lastIndexOf(".");
		if (lastDot > 0 && lastDot > 245) {
			const ext = sanitized.substring(lastDot);
			const name = sanitized.substring(0, 255 - ext.length);
			sanitized = name + ext;
		} else {
			sanitized = sanitized.substring(0, 255);
		}
	}

	// Ensure we have a valid filename
	if (!sanitized || sanitized === "." || sanitized === "..") {
		sanitized = "unnamed_file";
	}

	return sanitized;
}

/**
 * Validates that the file type is allowed.
 * @param contentType - The MIME type of the file
 * @throws Error if the file type is not allowed
 */
function validateFileType(contentType: string): void {
	const normalizedType = contentType.toLowerCase().trim();

	if (!(ALLOWED_TYPES as readonly string[]).includes(normalizedType)) {
		throw new Error(
			`File type "${contentType}" is not allowed. Allowed types: ${ALLOWED_TYPES.join(", ")}`
		);
	}
}

/**
 * Validates that the file size is within limits based on content type.
 * @param size - The file size in bytes
 * @param contentType - The MIME type of the file
 * @throws Error if the file size exceeds limits
 */
function validateFileSize(size: number, contentType: string): void {
	const normalizedType = contentType.toLowerCase().trim();

	if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalizedType)) {
		if (size > MAX_IMAGE_SIZE) {
			throw new Error(
				`Image file size (${(size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`
			);
		}
	} else if (
		(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(normalizedType)
	) {
		if (size > MAX_DOCUMENT_SIZE) {
			throw new Error(
				`Document file size (${(size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB`
			);
		}
	} else if (
		(ALLOWED_AUDIO_TYPES as readonly string[]).includes(normalizedType)
	) {
		if (size > MAX_AUDIO_SIZE) {
			throw new Error(
				`Audio file size (${(size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_AUDIO_SIZE / (1024 * 1024)}MB`
			);
		}
	} else if (
		(ALLOWED_VIDEO_TYPES as readonly string[]).includes(normalizedType)
	) {
		if (size > MAX_VIDEO_SIZE) {
			throw new Error(
				`Video file size (${(size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`
			);
		}
	} else {
		if (size > MAX_FILE_SIZE) {
			throw new Error(
				`File size (${(size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
			);
		}
	}
}

/**
 * Checks if the user has exceeded the upload rate limit.
 * @param ctx - The mutation context
 * @param userId - The user ID to check
 * @throws Error if rate limit is exceeded
 */
async function checkUploadRateLimit(
	ctx: MutationCtx,
	userId: Id<"users">
): Promise<void> {
	const now = Date.now();
	const windowStart = now - UPLOAD_RATE_LIMIT_WINDOW;

	// Query recent uploads within the rate limit window
	const recentUploads = await ctx.db
		.query("fileUploads")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.filter((q) => q.gte(q.field("uploadedAt"), windowStart))
		.collect();

	if (recentUploads.length >= MAX_UPLOADS_PER_WINDOW) {
		throw new Error(
			`Upload rate limit exceeded. Maximum ${MAX_UPLOADS_PER_WINDOW} uploads per minute allowed. Please try again later.`
		);
	}
}

// Exported Functions

/**
 * Generates a URL for uploading a file to Convex storage.
 * Checks user ownership of chat, quota limits, and rate limits before allowing upload.
 *
 * @param userId - The ID of the user uploading the file
 * @param chatId - The ID of the chat the file will be associated with
 * @returns An upload URL that can be used to upload the file
 * @throws Error if user doesn't own chat, exceeds quota, or hits rate limit
 */
export const generateUploadUrl = mutation({
	args: {
		userId: v.id("users"),
		chatId: v.id("chats"),
	},
	returns: v.string(),
	handler: async (ctx, args) => {
		// Verify the chat exists and belongs to the user
		const chat = await ctx.db.get(args.chatId);
		if (!chat) {
			throw new Error("Chat not found");
		}
		if (chat.userId !== args.userId) {
			throw new Error("Unauthorized: You do not own this chat");
		}

		// Check if user has exceeded their file quota
		const user = await ctx.db.get(args.userId);
		if (!user) {
			throw new Error("User not found");
		}

		const currentFileCount = user.fileUploadCount || 0;
		if (currentFileCount >= MAX_USER_FILES) {
			throw new Error(
				`File quota exceeded. Maximum ${MAX_USER_FILES} files allowed per user.`
			);
		}

		// Check upload rate limit
		await checkUploadRateLimit(ctx, args.userId);

		// Generate and return upload URL
		return await ctx.storage.generateUploadUrl();
	},
});

/**
 * Saves metadata for an uploaded file to the database.
 * Validates file size and type, sanitizes filename, and updates user quota.
 *
 * @param userId - The ID of the user who uploaded the file
 * @param chatId - The ID of the chat the file is associated with
 * @param storageId - The storage ID returned after uploading to Convex storage
 * @param filename - The original filename
 * @param contentType - The MIME type of the file
 * @param size - The file size in bytes
 * @returns Object containing the file ID and sanitized filename
 * @throws Error if validation fails
 */
export const saveFileMetadata = mutation({
	args: {
		userId: v.id("users"),
		chatId: v.id("chats"),
		storageId: v.id("_storage"),
		filename: v.string(),
		contentType: v.string(),
		size: v.number(),
	},
	returns: v.object({
		fileId: v.id("fileUploads"),
		filename: v.string(),
		url: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		// Validate file size
		validateFileSize(args.size, args.contentType);

		// Validate file type
		validateFileType(args.contentType);

		// Verify the chat exists and belongs to the user
		const chat = await ctx.db.get(args.chatId);
		if (!chat) {
			throw new Error("Chat not found");
		}
		if (chat.userId !== args.userId) {
			throw new Error("Unauthorized: You do not own this chat");
		}

		// Sanitize the filename
		const sanitizedFilename = sanitizeFilename(args.filename);

		// Insert file metadata into database
		const fileId = await ctx.db.insert("fileUploads", {
			userId: args.userId,
			chatId: args.chatId,
			storageId: args.storageId,
			filename: sanitizedFilename,
			contentType: args.contentType,
			size: args.size,
			uploadedAt: Date.now(),
		});

		// Increment user's file upload count
		const user = await ctx.db.get(args.userId);
		if (user) {
			await ctx.db.patch(args.userId, {
				fileUploadCount: (user.fileUploadCount || 0) + 1,
				updatedAt: Date.now(),
			});
		}

		// Get the storage URL immediately
		const url = await ctx.storage.getUrl(args.storageId);

		return {
			fileId,
			filename: sanitizedFilename,
			url,
		};
	},
});

/**
 * Retrieves a temporary URL to access a stored file.
 * Verifies that the user owns the file before providing access.
 *
 * @param storageId - The storage ID of the file
 * @param userId - The ID of the user requesting access
 * @returns A temporary URL to access the file, or null if not found/unauthorized
 */
export const getFileUrl = query({
	args: {
		storageId: v.id("_storage"),
		userId: v.id("users"),
	},
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		// Find the file by storage ID
		const file = await ctx.db
			.query("fileUploads")
			.withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
			.unique();

		// Verify file exists and user owns it
		if (!file) {
			return null;
		}

		if (file.userId !== args.userId) {
			throw new Error("Unauthorized: You do not own this file");
		}

		// Check if file has been deleted
		if (file.deletedAt) {
			return null;
		}

		// Generate and return the file URL
		return await ctx.storage.getUrl(args.storageId);
	},
});

/**
 * Deletes a file from both the database and storage.
 * Performs a soft delete in the database and hard delete from storage.
 * Decrements the user's file upload count.
 *
 * @param storageId - The storage ID of the file to delete
 * @param userId - The ID of the user requesting deletion
 * @returns Object indicating success or failure
 */
export const deleteFile = mutation({
	args: {
		storageId: v.id("_storage"),
		userId: v.id("users"),
	},
	returns: v.object({ ok: v.boolean() }),
	handler: async (ctx, args) => {
		// Find the file by storage ID
		const file = await ctx.db
			.query("fileUploads")
			.withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
			.unique();

		if (!file) {
			return { ok: false };
		}

		// Verify ownership
		if (file.userId !== args.userId) {
			throw new Error("Unauthorized: You do not own this file");
		}

		// Check if already deleted
		if (file.deletedAt) {
			return { ok: false };
		}

		// Soft delete in database
		await ctx.db.patch(file._id, {
			deletedAt: Date.now(),
		});

		// Hard delete from storage
		try {
			await ctx.storage.delete(args.storageId);
		} catch (error) {
			// Log error but don't fail the operation
			// File might already be deleted from storage
			console.error("Error deleting file from storage:", error);
		}

		// Decrement user's file upload count
		const user = await ctx.db.get(args.userId);
		if (user && user.fileUploadCount && user.fileUploadCount > 0) {
			await ctx.db.patch(args.userId, {
				fileUploadCount: user.fileUploadCount - 1,
				updatedAt: Date.now(),
			});
		}

		return { ok: true };
	},
});

/**
 * Retrieves the current file upload quota for a user.
 *
 * @param userId - The ID of the user
 * @returns Object containing used quota and total limit
 */
export const getUserQuota = query({
	args: {
		userId: v.id("users"),
	},
	returns: v.object({
		used: v.number(),
		limit: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);

		return {
			used: user?.fileUploadCount || 0,
			limit: MAX_USER_FILES,
		};
	},
});

/**
 * Retrieves all non-deleted files for a specific chat.
 *
 * @param chatId - The ID of the chat
 * @param userId - The ID of the user (for authorization)
 * @returns Array of file metadata objects
 */
export const getFilesByChat = query({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
	},
	returns: v.array(
		v.object({
			_id: v.id("fileUploads"),
			_creationTime: v.number(),
			storageId: v.id("_storage"),
			filename: v.string(),
			contentType: v.string(),
			size: v.number(),
			uploadedAt: v.number(),
		})
	),
	handler: async (ctx, args) => {
		// Verify the chat exists and belongs to the user
		const chat = await ctx.db.get(args.chatId);
		if (!chat) {
			throw new Error("Chat not found");
		}
		if (chat.userId !== args.userId) {
			throw new Error("Unauthorized: You do not own this chat");
		}

		// Query all non-deleted files for this chat
		const files = await ctx.db
			.query("fileUploads")
			.withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
			.filter((q) => q.eq(q.field("deletedAt"), undefined))
			.order("desc")
			.collect();

		return files.map((file) => ({
			_id: file._id,
			_creationTime: file._creationTime,
			storageId: file.storageId,
			filename: file.filename,
			contentType: file.contentType,
			size: file.size,
			uploadedAt: file.uploadedAt,
		}));
	},
});

/**
 * Retrieves all non-deleted files for a specific user.
 *
 * @param userId - The ID of the user
 * @returns Array of file metadata objects with chat information
 */
export const getFilesByUser = query({
	args: {
		userId: v.id("users"),
	},
	returns: v.array(
		v.object({
			_id: v.id("fileUploads"),
			_creationTime: v.number(),
			chatId: v.id("chats"),
			storageId: v.id("_storage"),
			filename: v.string(),
			contentType: v.string(),
			size: v.number(),
			uploadedAt: v.number(),
		})
	),
	handler: async (ctx, args) => {
		// Query all non-deleted files for this user
		const files = await ctx.db
			.query("fileUploads")
			.withIndex("by_user_not_deleted", (q) =>
				q.eq("userId", args.userId).eq("deletedAt", undefined)
			)
			.order("desc")
			.collect();

		return files.map((file) => ({
			_id: file._id,
			_creationTime: file._creationTime,
			chatId: file.chatId,
			storageId: file.storageId,
			filename: file.filename,
			contentType: file.contentType,
			size: file.size,
			uploadedAt: file.uploadedAt,
		}));
	},
});
