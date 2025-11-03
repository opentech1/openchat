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
	})
		.index("by_external_id", ["externalId"])
		.index("by_email", ["email"]),
	chats: defineTable({
		userId: v.id("users"),
		title: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
		lastMessageAt: v.optional(v.number()),
		status: v.optional(v.string()),
	})
		.index("by_user", ["userId", "updatedAt"])
		.index("by_user_status", ["userId", "status", "updatedAt"]),
	messages: defineTable({
		chatId: v.id("chats"),
		clientMessageId: v.optional(v.string()),
		role: v.string(),
		content: v.string(),
		createdAt: v.number(),
		status: v.string(),
	})
		.index("by_chat", ["chatId", "createdAt"])
		.index("by_client_id", ["chatId", "clientMessageId"])
		.index("by_chat_status", ["chatId", "status", "createdAt"])
		.index("by_status", ["status"]),
});
