import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Input sanitization for chat titles
const MAX_TITLE_LENGTH = 200;

function sanitizeTitle(title: string): string {
	// Trim whitespace
	let sanitized = title.trim();
	
	// Replace control characters including null bytes ([\x00-\x1F\x7F])
	// except newlines and tabs which we'll convert to spaces
	sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
	
	// Convert newlines and tabs to single spaces
	sanitized = sanitized.replace(/[\n\r\t]+/g, " ");
	
	// Collapse multiple spaces into one
	sanitized = sanitized.replace(/\s+/g, " ");
	
	// Truncate to maximum length
	if (sanitized.length > MAX_TITLE_LENGTH) {
		sanitized = sanitized.slice(0, MAX_TITLE_LENGTH);
	}
	
	// If empty after sanitization, provide default
	if (sanitized.length === 0) {
		return "New Chat";
	}
	
	return sanitized;
}

const chatDoc = v.object({
	_id: v.id("chats"),
	_creationTime: v.number(),
	userId: v.id("users"),
	title: v.string(),
	createdAt: v.number(),
	updatedAt: v.number(),
	lastMessageAt: v.optional(v.number()),
	deletedAt: v.optional(v.number()),
});

export const list = query({
	args: {
		userId: v.id("users"),
		cursor: v.optional(v.string()),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		chats: v.array(chatDoc),
		nextCursor: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50;

		// Filter out soft-deleted chats in the query, then use paginate
		const results = await ctx.db
			.query("chats")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.filter((q) => q.eq(q.field("deletedAt"), undefined))
			.paginate({
				cursor: args.cursor ?? null,
				numItems: limit,
			});

		return {
			chats: results.page,
			nextCursor: results.continueCursor ?? null,
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
		if (!chat || chat.userId !== args.userId || chat.deletedAt) return null;
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
		// Sanitize the title to prevent injection attacks and ensure valid input
		const sanitizedTitle = sanitizeTitle(args.title);

		// Rate limit: check recent NON-DELETED chat creation
		// Important: filter out deleted chats to prevent bypass via create/delete loop
		// Use by_user_created index to sort by createdAt, preventing bypass via chat updates
		const recentChat = await ctx.db
			.query("chats")
			.withIndex("by_user_created", (q) => q.eq("userId", args.userId))
			.order("desc")
			.filter((q) => q.eq(q.field("deletedAt"), undefined))
			.first();

		const now = Date.now();
		const rateLimit = 60 * 1000; // 1 minute
		if (recentChat) {
			const lastChatTime = recentChat.createdAt;
			if (now - lastChatTime < rateLimit) {
				throw new Error("Rate limit exceeded. Please wait before creating another chat.");
			}
		}

		const chatId = await ctx.db.insert("chats", {
			userId: args.userId,
			title: sanitizedTitle,
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
	returns: v.object({ ok: v.boolean() }),
	handler: async (ctx, args) => {
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== args.userId || chat.deletedAt) {
			return { ok: false } as const;
		}
		const now = Date.now();
		// Soft delete: mark chat as deleted instead of hard delete
		await ctx.db.patch(args.chatId, {
			deletedAt: now,
		});
		// Cascade soft delete to all messages in the chat (skip already deleted messages)
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
			.collect();
		await Promise.all(
			messages
				.filter((message) => !message.deletedAt)
				.map((message) =>
					ctx.db.patch(message._id, {
						deletedAt: now,
					}),
				),
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
	if (!chat || chat.userId !== userId || chat.deletedAt) {
		return null;
	}
	return chat;
}

