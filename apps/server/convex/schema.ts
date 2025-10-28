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
		title: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
		lastMessageAt: v.optional(v.number()),
	}).index("by_user", ["userId", "updatedAt"]),
	messages: defineTable({
		chatId: v.id("chats"),
		clientMessageId: v.optional(v.string()),
		role: v.string(),
		content: v.string(),
		createdAt: v.number(),
		status: v.optional(v.string()),
	})
		.index("by_chat", ["chatId", "createdAt"])
		.index("by_client_id", ["chatId", "clientMessageId"]),
});
