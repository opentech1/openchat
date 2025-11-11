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
	})
		.index("by_user", ["userId", "updatedAt"])
		.index("by_user_created", ["userId", "createdAt"]),
	messages: defineTable({
		chatId: v.id("chats"),
		clientMessageId: v.optional(v.string()),
		role: v.string(),
		// Content can be encrypted (prefixed with enc_v1:). Max length: 100KB (102400 bytes)
		content: v.string(),
		createdAt: v.number(),
		status: v.optional(v.string()),
		userId: v.optional(v.id("users")),
		deletedAt: v.optional(v.number()),
	})
		.index("by_chat", ["chatId", "createdAt"])
		.index("by_client_id", ["chatId", "clientMessageId"])
		.index("by_user", ["userId"]),
});
