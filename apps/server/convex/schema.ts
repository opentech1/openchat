import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Note: Better-auth tables are automatically provided by the betterAuth component
// configured in convex.config.ts. They don't need to be imported here.
export default defineSchema({
	users: defineTable({
		externalId: v.string(),
		email: v.optional(v.string()),
		name: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
		encryptedOpenRouterKey: v.optional(v.string()),
		// File upload quota tracking
		fileUploadCount: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_external_id", ["externalId"])
		.index("by_email", ["email"]),
	chats: defineTable({
		userId: v.id("users"),
		// Title can be encrypted (prefixed with enc_v1:)
		title: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
		lastMessageAt: v.optional(v.number()),
		deletedAt: v.optional(v.number()),
		// PERFORMANCE OPTIMIZATION: Track message count to avoid expensive queries
		// This field is maintained by message insert/delete operations
		messageCount: v.optional(v.number()),
	})
		.index("by_user", ["userId", "updatedAt"])
		.index("by_user_created", ["userId", "createdAt"])
		.index("by_user_last_message", ["userId", "lastMessageAt"])
		.index("by_user_not_deleted", ["userId", "deletedAt", "updatedAt"])
		.index("by_user_title", ["userId", "title"]),
	messages: defineTable({
		chatId: v.id("chats"),
		clientMessageId: v.optional(v.string()),
		role: v.string(),
		// Content can be encrypted (prefixed with enc_v1:). Max length: 100KB (102400 bytes)
		content: v.string(),
		// Reasoning content from models with reasoning capabilities (e.g., Claude 4, GPT-5, DeepSeek R1)
		reasoning: v.optional(v.string()),
		// Time spent thinking in milliseconds (for reasoning models)
		thinkingTimeMs: v.optional(v.number()),
		// File attachments
		attachments: v.optional(
			v.array(
				v.object({
					storageId: v.id("_storage"),
					filename: v.string(),
					contentType: v.string(),
					size: v.number(),
					uploadedAt: v.number(),
					url: v.optional(v.string()),
				})
			)
		),
		createdAt: v.number(),
		status: v.optional(v.string()),
		userId: v.optional(v.id("users")),
		deletedAt: v.optional(v.number()),
	})
		.index("by_chat", ["chatId", "createdAt"])
		.index("by_client_id", ["chatId", "clientMessageId"])
		.index("by_user", ["userId"])
		.index("by_user_status", ["userId", "status", "createdAt"])
		.index("by_chat_not_deleted", ["chatId", "deletedAt", "createdAt"])
		.index("by_user_created", ["userId", "createdAt"]),
	fileUploads: defineTable({
		userId: v.id("users"),
		chatId: v.id("chats"),
		storageId: v.id("_storage"),
		filename: v.string(),
		contentType: v.string(),
		size: v.number(),
		uploadedAt: v.number(),
		deletedAt: v.optional(v.number()),
	})
		.index("by_user", ["userId", "uploadedAt"])
		.index("by_chat", ["chatId", "uploadedAt"])
		.index("by_storage", ["storageId"])
		.index("by_user_not_deleted", ["userId", "deletedAt", "uploadedAt"]),
	// PERFORMANCE OPTIMIZATION: Database statistics table for efficient monitoring
	// Stores aggregated counts to avoid expensive full-table scans
	dbStats: defineTable({
		// Unique key for each stat (e.g., "chats_total", "chats_soft_deleted", etc.)
		key: v.string(),
		// Numeric value of the stat
		value: v.number(),
		// Timestamp of last update
		updatedAt: v.number(),
		// Optional metadata for the stat
		metadata: v.optional(v.object({
			description: v.optional(v.string()),
			category: v.optional(v.string()),
		})),
	})
		.index("by_key", ["key"]),
});
