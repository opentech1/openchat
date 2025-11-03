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
		cursor: v.optional(v.string()),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		chats: v.array(chatDoc),
		cursor: v.union(v.string(), v.null()),
		isDone: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const limit = Math.min(args.limit ?? 50, 100);
		const results = await ctx.db
			.query("chats")
			.withIndex("by_user_status", (q) => 
				q.eq("userId", args.userId).eq("status", "active")
			)
			.order("desc")
			.paginate({ cursor: args.cursor ?? null, numItems: limit });
		
		return {
			chats: results.page,
			cursor: results.continueCursor,
			isDone: results.isDone,
		};
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
		// Rate limit: check recent chat creation
		const recentChats = await ctx.db
			.query("chats")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.take(1);
		
		const now = Date.now();
		const rateLimit = 60 * 1000; // 1 minute
		if (recentChats.length > 0) {
			const lastChatTime = recentChats[0].createdAt;
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
		
		// Soft delete all messages in this chat using batch update
		// This is more efficient than the previous N+1 approach
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_chat_status", (q) => 
				q.eq("chatId", args.chatId).eq("status", "completed")
			)
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
