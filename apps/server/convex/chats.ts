import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("chats")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.take(200);
	},
});

export const get = query({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
	},
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
	handler: async (ctx, args) => {
		const now = Date.now();
		const chatId = await ctx.db.insert("chats", {
			userId: args.userId,
			title: args.title,
			createdAt: now,
			updatedAt: now,
			lastMessageAt: now,
		});
		return { chatId };
	},
});

export const remove = mutation({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== args.userId) {
			return { ok: false } as const;
		}
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
			.collect();
		await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
		await ctx.db.delete(args.chatId);
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
