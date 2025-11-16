import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { incrementStat, decrementStat, STAT_KEYS } from "./lib/dbStats";

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
	messageCount: v.optional(v.number()),
});

// Optimized chat list response: exclude redundant fields to reduce bandwidth
const chatListItemDoc = v.object({
	_id: v.id("chats"),
	title: v.string(),
	createdAt: v.number(),
	updatedAt: v.number(),
	lastMessageAt: v.optional(v.number()),
});

// Security configuration: enforce maximum chat list limit
const MAX_CHAT_LIST_LIMIT = 200;
const DEFAULT_CHAT_LIST_LIMIT = 50;

export const list = query({
	args: {
		userId: v.id("users"),
		cursor: v.optional(v.string()),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		chats: v.array(chatListItemDoc),
		nextCursor: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		// SECURITY: Enforce maximum limit to prevent unbounded queries
		// Even if client requests more, cap at MAX_CHAT_LIST_LIMIT
		let limit = args.limit ?? DEFAULT_CHAT_LIST_LIMIT;

		// Validate and enforce maximum limit
		if (!Number.isFinite(limit) || limit <= 0) {
			limit = DEFAULT_CHAT_LIST_LIMIT;
		} else if (limit > MAX_CHAT_LIST_LIMIT) {
			limit = MAX_CHAT_LIST_LIMIT;
		}

		// PERFORMANCE OPTIMIZATION: Use by_user_not_deleted index to filter soft-deleted chats at index level
		// This is much faster than loading all chats and filtering in JavaScript
		// Index structure: [userId, deletedAt, updatedAt] allows efficient filtering
		const results = await ctx.db
			.query("chats")
			.withIndex("by_user_not_deleted", (q) =>
				q.eq("userId", args.userId).eq("deletedAt", undefined)
			)
			.order("desc")
			.paginate({
				cursor: args.cursor ?? null,
				numItems: limit,
			});

		// BANDWIDTH OPTIMIZATION: Filter out redundant fields (14% reduction per chat)
		// - userId: All chats belong to querying user (redundant)
		// - _creationTime: Duplicates createdAt field
		// - deletedAt: Always undefined (filtered at index level)
		// - messageCount: Not used in frontend chat list
		return {
			chats: results.page.map(chat => ({
				_id: chat._id,
				title: chat.title,
				createdAt: chat.createdAt,
				updatedAt: chat.updatedAt,
				lastMessageAt: chat.lastMessageAt,
			})),
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
		const rateLimit = 3 * 1000; // 3 seconds
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
			messageCount: 0, // Initialize with zero messages
		});

		// PERFORMANCE OPTIMIZATION: Update stats counter when creating chat
		await incrementStat(ctx, STAT_KEYS.CHATS_TOTAL);

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

		// PERFORMANCE OPTIMIZATION: Cascade soft delete to all messages in the chat
		// Use by_chat_not_deleted index to filter at database level (much faster)
		// Use Promise.all for parallel execution to minimize total time
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_chat_not_deleted", (q) =>
				q.eq("chatId", args.chatId).eq("deletedAt", undefined)
			)
			.collect();

		await Promise.all(
			messages.map((message) =>
				ctx.db.patch(message._id, {
					deletedAt: now,
				}),
			),
		);

		// Soft delete: mark chat as deleted instead of hard delete
		// PERFORMANCE OPTIMIZATION: Reset messageCount since all messages are soft-deleted
		await ctx.db.patch(args.chatId, {
			deletedAt: now,
			messageCount: 0,
		});

		// PERFORMANCE OPTIMIZATION: Update stats counters when soft-deleting
		await incrementStat(ctx, STAT_KEYS.CHATS_SOFT_DELETED);
		await decrementStat(ctx, STAT_KEYS.MESSAGES_SOFT_DELETED, messages.length);

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

