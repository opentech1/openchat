import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Input sanitization for chat titles
const MAX_TITLE_LENGTH = 200;

function sanitizeTitle(title: string): string {
	// Remove any null bytes
	let sanitized = title.replace(/\0/g, "");
	
	// Trim whitespace
	sanitized = sanitized.trim();
	
	// Replace control characters (except newlines and tabs which we'll convert to spaces)
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
});

export const list = query({
	args: {
		userId: v.id("users"),
	},
	returns: v.array(chatDoc),
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
		// Sanitize the title to prevent injection attacks and ensure valid input
		const sanitizedTitle = sanitizeTitle(args.title);
		
		const now = Date.now();
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
