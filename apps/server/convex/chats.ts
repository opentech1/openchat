import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const chatDoc = v.object({
	_id: v.id("chats"),
	_creationTime: v.number(),
	userId: v.id("users"),
	title: v.string(),
	createdAt: v.number(),
	updatedAt: v.number(),
	lastMessageAt: v.optional(v.number()),
	status: v.optional(v.string()),
});

export const list = query({
	args: {
		userId: v.id("users"),
	},
	returns: v.array(chatDoc),
	handler: async (ctx, args) => {
		// Query chats without filtering by status to handle existing data
		// Filter out deleted chats in application logic
		const allChats = await ctx.db
			.query("chats")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.collect();

		// Filter out deleted chats (handle undefined status for existing data)
		return allChats.filter((chat) => chat.status !== "deleted");
	},
});

export const get = query({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
	},
	returns: v.union(chatDoc, v.null()),
	handler: async (ctx, args) => {
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== args.userId) return null;
		return chat;
	},
});

export const create = mutation({
	args: {
		userId: v.id("users"),
		title: v.string(),
	},
	returns: v.object({ chatId: v.id("chats") }),
	handler: async (ctx, args) => {
		// Rate limit: check recent NON-DELETED chat creation
		// Important: filter out deleted chats to prevent bypass via create/delete loop
		const recentChats = await ctx.db
			.query("chats")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.collect();

		// Find most recent non-deleted chat
		const recentActiveChats = recentChats.filter((chat) => chat.status !== "deleted");

		const now = Date.now();
		const rateLimit = 60 * 1000; // 1 minute
		if (recentActiveChats.length > 0) {
			const lastChatTime = recentActiveChats[0].createdAt;
			if (now - lastChatTime < rateLimit) {
				throw new Error("Rate limit exceeded. Please wait before creating another chat.");
			}
		}

		const chatId = await ctx.db.insert("chats", {
			userId: args.userId,
			title: args.title,
			createdAt: now,
			updatedAt: now,
			lastMessageAt: now,
			status: "active",
		});
		return { chatId };
	},
});

export const remove = mutation({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
	},
	returns: v.object({ ok: v.boolean() }),
	handler: async (ctx, args) => {
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== args.userId) {
			return { ok: false } as const;
		}

		// Soft delete: mark chat as deleted
		await ctx.db.patch(args.chatId, {
			status: "deleted",
			updatedAt: Date.now(),
		});

		// Soft delete ALL messages in this chat (not just completed ones)
		// This handles messages with any status: "streaming", "completed", etc.
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
			.collect();

		// Batch update messages to deleted status
		await Promise.all(
			messages.map((message) =>
				ctx.db.patch(message._id, { status: "deleted" })
			)
		);

		return { ok: true } as const;
	},
});

export async function assertOwnsChat(
	ctx: MutationCtx | QueryCtx,
	chatId: Id<"chats">,
	userId: Id<"users">,
) {
	const chat = await ctx.db.get(chatId);
	if (!chat || chat.userId !== userId) {
		return null;
	}
	return chat;
}

