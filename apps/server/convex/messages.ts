import type { Id } from "./_generated/dataModel";
import { assertOwnsChat } from "./chats";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const chat = await assertOwnsChat(ctx, args.chatId, args.userId);
		if (!chat) return [];
		return await ctx.db
			.query("messages")
			.withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
			.order("asc")
			.collect();
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
	handler: async (ctx, args) => {
		const chat = await assertOwnsChat(ctx, args.chatId, args.userId);
		if (!chat) return { ok: false as const };

		const userCreatedAt = args.userMessage.createdAt ?? Date.now();
		const userMessageId = await insertOrUpdateMessage(ctx, {
			chatId: args.chatId,
			role: "user",
			content: args.userMessage.content,
			createdAt: userCreatedAt,
			clientMessageId: args.userMessage.clientMessageId,
			status: "completed",
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
			});
		}

		await ctx.db.patch(args.chatId, {
			updatedAt: assistantCreatedAt ?? userCreatedAt,
			lastMessageAt: assistantCreatedAt ?? userCreatedAt,
		});

		return {
			ok: true as const,
			userMessageId,
			assistantMessageId,
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
	handler: async (ctx, args) => {
		const chat = await assertOwnsChat(ctx, args.chatId, args.userId);
		if (!chat) return { ok: false as const };
		const timestamp = args.createdAt ?? Date.now();
		const messageId = await insertOrUpdateMessage(ctx, {
			chatId: args.chatId,
			role: args.role,
			content: args.content,
			createdAt: timestamp,
			status: args.status ?? "streaming",
			clientMessageId: args.clientMessageId,
			overrideId: args.messageId ?? undefined,
		});

		if (args.role === "assistant" && args.status === "completed") {
			await ctx.db.patch(args.chatId, {
				lastMessageAt: Date.now(),
				updatedAt: Date.now(),
			});
		}

		return { ok: true as const, messageId };
	},
});

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
	},
) {
	let targetId = args.overrideId;
	if (!targetId && args.clientMessageId) {
		const existing = await ctx.db
			.query("messages")
			.withIndex("by_client_id", (q) =>
				q.eq("chatId", args.chatId).eq("clientMessageId", args.clientMessageId!),
			)
			.unique();
		if (existing) {
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
		});
	} else {
		await ctx.db.patch(targetId, {
			clientMessageId: args.clientMessageId ?? undefined,
			role: args.role,
			content: args.content,
			createdAt: args.createdAt,
			status: args.status,
		});
	}
	return targetId;
}
