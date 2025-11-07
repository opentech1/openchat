/**
 * Input Validation Schemas
 *
 * Centralized validation schemas using Zod for API endpoints.
 * This ensures consistent validation and prevents injection attacks.
 */

import { z } from "zod";

/**
 * Convex ID format validation
 * Convex IDs are base64url encoded strings with a specific format
 */
export const convexIdSchema = z
	.string()
	.min(1, "ID cannot be empty")
	.max(100, "ID too long")
	.regex(/^[a-zA-Z0-9_-]+$/, "Invalid ID format");

/**
 * Chat ID validation
 */
export const chatIdSchema = convexIdSchema;

/**
 * Message ID validation
 */
export const messageIdSchema = z
	.string()
	.min(1, "Message ID cannot be empty")
	.max(200, "Message ID too long");

/**
 * Chat title validation
 */
export const chatTitleSchema = z
	.string()
	.min(1, "Title cannot be empty")
	.max(200, "Title too long")
	.trim();

/**
 * Message content validation
 */
export const messageContentSchema = z
	.string()
	.min(1, "Message content cannot be empty")
	.max(50_000, "Message content too long");

/**
 * Model ID validation (for OpenRouter)
 */
export const modelIdSchema = z
	.string()
	.min(1, "Model ID cannot be empty")
	.max(200, "Model ID too long")
	.regex(
		/^[a-zA-Z0-9_\-/:@.]+$/,
		"Model ID contains invalid characters",
	);

/**
 * API Key validation (basic format check)
 */
export const apiKeySchema = z
	.string()
	.min(10, "API key too short")
	.max(500, "API key too long");

/**
 * Timestamp validation
 */
export const timestampSchema = z.union([
	z.string().datetime(),
	z.date(),
	z.number().positive(),
]);

/**
 * Chat creation validation
 */
export const createChatSchema = z.object({
	title: chatTitleSchema.optional().default("New Chat"),
});

/**
 * Delete chat validation
 */
export const deleteChatSchema = z.object({
	id: chatIdSchema,
});

/**
 * Message schema for sending messages
 */
export const sendMessageSchema = z.object({
	chatId: chatIdSchema,
	userMessage: z.object({
		id: messageIdSchema.optional(),
		content: messageContentSchema,
		createdAt: timestampSchema.optional(),
	}),
	assistantMessage: z
		.object({
			id: messageIdSchema.optional(),
			content: messageContentSchema,
			createdAt: timestampSchema.optional(),
		})
		.optional(),
});

/**
 * Pagination validation
 */
export const paginationSchema = z.object({
	cursor: z.string().optional(),
	limit: z.number().int().positive().max(100).optional().default(50),
});

/**
 * Safe parse helper that returns typed result
 */
export function safeValidate<T extends z.ZodType>(
	schema: T,
	data: unknown,
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
	const result = schema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}

/**
 * Create validation error response
 */
export function createValidationErrorResponse(
	error: z.ZodError,
	headers?: HeadersInit,
): Response {
	return new Response(
		JSON.stringify({
			error: "Validation failed",
			issues: error.issues.map((err: z.ZodIssue) => ({
				path: err.path.join("."),
				message: err.message,
				code: err.code,
			})),
		}),
		{
			status: 400,
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
		},
	);
}
