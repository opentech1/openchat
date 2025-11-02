import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		externalId: v.string(),
		email: v.optional(v.string()),
		name: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_external_id", ["externalId"]),
	chats: defineTable({
		userId: v.id("users"),
		// Plain text title (deprecated - for backwards compatibility)
		title: v.optional(v.string()),
		// Encrypted title fields (E2E encryption)
		encryptedTitle: v.optional(v.string()),
		titleIv: v.optional(v.string()),
		titleEncryptionVersion: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
		lastMessageAt: v.optional(v.number()),
	}).index("by_user", ["userId", "updatedAt"]),
	messages: defineTable({
		chatId: v.id("chats"),
		clientMessageId: v.optional(v.string()),
		role: v.string(),
		// Plain text content (deprecated - for backwards compatibility)
		content: v.optional(v.string()),
		// Encrypted content fields (E2E encryption)
		encryptedContent: v.optional(v.string()),
		contentIv: v.optional(v.string()),
		contentEncryptionVersion: v.optional(v.string()),
		createdAt: v.number(),
		status: v.optional(v.string()),
	})
		.index("by_chat", ["chatId", "createdAt"])
		.index("by_client_id", ["chatId", "clientMessageId"]),
});
