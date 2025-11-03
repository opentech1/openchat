import type { Id } from "./_generated/dataModel";
import { assertOwnsChat } from "./chats";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const messageDoc = v.object({
	_id: v.id("messages"),
	_creationTime: v.number(),
	chatId: v.id("chats"),
	clientMessageId: v.optional(v.string()),
	role: v.string(),
	content: v.string(),
	createdAt: v.number(),
	status: v.optional(v.string()),
	userId: v.optional(v.id("users")),
	deletedAt: v.optional(v.number()),
});

export const list = query({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
	},
	returns: v.array(messageDoc),
	handler: async (ctx, args) => {
		const chat = await assertOwnsChat(ctx, args.chatId, args.userId);
		if (!chat) return [];
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
			.order("asc")
			.collect();
		// Filter out soft-deleted messages
		return messages.filter((message) => !message.deletedAt);
	},
});

export const send = mutation({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
		userMessage: v.object({
			content: v.string(),
			createdAt: v.optional(v.number()),
			clientMessageId: v.optional(v.string()),
		}),
		assistantMessage: v.optional(
			v.object({
				content: v.string(),
				createdAt: v.optional(v.number()),
				clientMessageId: v.optional(v.string()),
			}),
		),
	},
	returns: v.object({
		ok: v.boolean(),
		userMessageId: v.optional(v.id("messages")),
		assistantMessageId: v.optional(v.id("messages")),
	}),
	handler: async (ctx, args) => {
		const chat = await assertOwnsChat(ctx, args.chatId, args.userId);
		if (!chat) {
			return { ok: false as const, userMessageId: undefined, assistantMessageId: undefined };
		}

		const userCreatedAt = args.userMessage.createdAt ?? Date.now();
		const userMessageId = await insertOrUpdateMessage(ctx, {
			chatId: args.chatId,
			role: "user",
			content: args.userMessage.content,
			createdAt: userCreatedAt,
			clientMessageId: args.userMessage.clientMessageId,
			status: "completed",
			userId: args.userId,
		});

		let assistantMessageId: Id<"messages"> | null = null;
		const assistantCreatedAt =
			args.assistantMessage?.createdAt ?? userCreatedAt + 1;
		if (args.assistantMessage) {
			assistantMessageId = await insertOrUpdateMessage(ctx, {
				chatId: args.chatId,
				role: "assistant",
				content: args.assistantMessage.content,
				createdAt: assistantCreatedAt,
				clientMessageId: args.assistantMessage.clientMessageId,
				status: "completed",
				userId: args.userId,
			});
		}

		await ctx.db.patch(args.chatId, {
			updatedAt: assistantCreatedAt ?? userCreatedAt,
			lastMessageAt: assistantCreatedAt ?? userCreatedAt,
		});

		return {
			ok: true as const,
			userMessageId,
			assistantMessageId: assistantMessageId ?? undefined,
		};
	},
});

export const streamUpsert = mutation({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
		messageId: v.optional(v.id("messages")),
		clientMessageId: v.optional(v.string()),
		role: v.string(),
		content: v.string(),
		createdAt: v.optional(v.number()),
		status: v.optional(v.string()),
	},
	returns: v.object({
		ok: v.boolean(),
		messageId: v.optional(v.id("messages")),
	}),
	handler: async (ctx, args) => {
		const chat = await assertOwnsChat(ctx, args.chatId, args.userId);
		if (!chat) {
			return { ok: false as const, messageId: undefined };
		}
		const timestamp = args.createdAt ?? Date.now();
		const messageId = await insertOrUpdateMessage(ctx, {
			chatId: args.chatId,
			role: args.role,
			content: args.content,
			createdAt: timestamp,
			status: args.status ?? "streaming",
			clientMessageId: args.clientMessageId,
			overrideId: args.messageId ?? undefined,
			userId: args.userId,
		});

		if (args.status === "completed" && (args.role === "assistant" || args.role === "user")) {
			const patchTimestamp = args.role === "assistant" ? Date.now() : timestamp;
			await ctx.db.patch(args.chatId, {
				lastMessageAt: patchTimestamp,
				updatedAt: patchTimestamp,
			});
		}

		return { ok: true as const, messageId };
	},
});

const MAX_MESSAGE_CONTENT_LENGTH = 100 * 1024; // 100KB

async function insertOrUpdateMessage(
	ctx: MutationCtx,
	args: {
		chatId: Id<"chats">;
		role: string;
		content: string;
		createdAt: number;
		status: string;
		clientMessageId?: string | null;
		overrideId?: Id<"messages">;
		userId?: Id<"users">;
	},
) {
	// Validate message content length (100KB max) - count actual bytes, not string length
	const contentBytes = new TextEncoder().encode(args.content).length;
	if (contentBytes > MAX_MESSAGE_CONTENT_LENGTH) {
		throw new Error(
			`Message content exceeds maximum length of ${MAX_MESSAGE_CONTENT_LENGTH} bytes`,
		);
	}
	let targetId = args.overrideId;
	if (!targetId && args.clientMessageId) {
		const existing = await ctx.db
			.query("messages")
			.withIndex("by_client_id", (q) =>
				q.eq("chatId", args.chatId).eq("clientMessageId", args.clientMessageId!),
			)
			.unique();
		// Only reuse the message if it hasn't been soft-deleted
		if (existing && !existing.deletedAt) {
			targetId = existing._id;
		}
	}
	if (!targetId) {
		targetId = await ctx.db.insert("messages", {
			chatId: args.chatId,
			clientMessageId: args.clientMessageId ?? undefined,
			role: args.role,
			content: args.content,
			createdAt: args.createdAt,
			status: args.status,
			userId: args.userId ?? undefined,
		});
	} else {
		await ctx.db.patch(targetId, {
			clientMessageId: args.clientMessageId ?? undefined,
			role: args.role,
			content: args.content,
			createdAt: args.createdAt,
			status: args.status,
			userId: args.userId ?? undefined,
		});
	}
	return targetId;
}
