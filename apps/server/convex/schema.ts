import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
	...authTables,
	
	chats: defineTable({
		userId: v.string(),
		title: v.string(),
		model: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_user_updated", ["userId", "updatedAt"]),
	
	messages: defineTable({
		chatId: v.id("chats"),
		userId: v.string(),
		content: v.string(),
		role: v.union(v.literal("user"), v.literal("assistant")),
		model: v.optional(v.string()),
		isStreaming: v.optional(v.boolean()),
		createdAt: v.number(),
	})
		.index("by_chat", ["chatId"])
		.index("by_chat_created", ["chatId", "createdAt"]),
});
