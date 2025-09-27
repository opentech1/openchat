import { protectedProcedure, publicProcedure } from "../lib/orpc";
import type { RouterClient } from "@orpc/server";
import { z } from "zod";
import { db } from "../db";
import { chat, message } from "../db/schema/chat";
import { and, desc, eq, asc } from "drizzle-orm";
import { publish } from "../lib/sync-hub";

function cuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

// In-memory fallback when DB is unreachable (dev convenience)
type ChatRow = {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
};
type MsgRow = {
  id: string;
  chatId: string;
  role: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};
const memChatsByUser = new Map<string, ChatRow[]>();
const memMsgsByChat = new Map<string, MsgRow[]>();

const FALLBACK_CHAT_LIMIT = 50;
const FALLBACK_CHAT_TTL_MS = 15 * 60_000;
const FALLBACK_MESSAGE_LIMIT = 500;
const FALLBACK_MESSAGE_TTL_MS = 15 * 60_000;

function pruneChatList(list: ChatRow[], now = Date.now()) {
	const filtered = list
		.filter((row) => now - row.updatedAt.getTime() <= FALLBACK_CHAT_TTL_MS)
		.sort(
			(a, b) =>
				(b.lastMessageAt?.getTime() ?? b.updatedAt.getTime()) -
				(a.lastMessageAt?.getTime() ?? a.updatedAt.getTime()),
		);
	if (filtered.length > FALLBACK_CHAT_LIMIT) {
		filtered.length = FALLBACK_CHAT_LIMIT;
	}
	return filtered;
}

function pruneMessagesList(list: MsgRow[], now = Date.now()) {
	const filtered = list
		.filter((row) => now - row.updatedAt.getTime() <= FALLBACK_MESSAGE_TTL_MS)
		.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	if (filtered.length > FALLBACK_MESSAGE_LIMIT) {
		filtered.splice(0, filtered.length - FALLBACK_MESSAGE_LIMIT);
	}
	return filtered;
}

function addFallbackChat(userId: string, record: ChatRow) {
	const list = memChatsByUser.get(userId) ?? [];
	list.push(record);
	memChatsByUser.set(userId, pruneChatList(list));
}

function pruneUserChats(userId: string) {
	const list = memChatsByUser.get(userId);
	if (!list) return;
	memChatsByUser.set(userId, pruneChatList(list));
}

function setFallbackMessages(chatId: string, list: MsgRow[]) {
	memMsgsByChat.set(chatId, pruneMessagesList(list));
}

function addFallbackMessage(chatId: string, row: MsgRow) {
	const list = memMsgsByChat.get(chatId) ?? [];
	list.push(row);
	setFallbackMessages(chatId, list);
}

export function inMemoryChatOwned(userId: string, chatId: string) {
	const list = memChatsByUser.get(userId) ?? [];
	return list.some((chat) => chat.id === chatId);
}

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
	chats: {
    // Create a new chat and return its id
    create: protectedProcedure
      .input(
        z
          .object({
            title: z.string().min(1).max(120).optional(),
            id: z.string().uuid().optional(),
          })
          .optional(),
      )
      .handler(async ({ context, input }) => {
        const id = input?.id ?? cuid();
        const now = new Date();
        try {
          await db.insert(chat).values({
            id,
            userId: context.session!.user.id,
            title: input?.title ?? "New Chat",
            createdAt: now,
            updatedAt: now,
            lastMessageAt: now,
          });
          // emit sidebar add
          publish(
            `chats:index:${context.session!.user.id}`,
            "chats.index.add",
            { chatId: id, title: input?.title ?? "New Chat", updatedAt: now, lastMessageAt: now },
          );
		} catch {
			addFallbackChat(context.session!.user.id, {
				id,
				userId: context.session!.user.id,
				title: input?.title ?? "New Chat",
				createdAt: now,
				updatedAt: now,
				lastMessageAt: now,
			});
			publish(
				`chats:index:${context.session!.user.id}`,
				"chats.index.add",
				{ chatId: id, title: input?.title ?? "New Chat", updatedAt: now, lastMessageAt: now },
          );
        }
        return { id };
      }),
    // List chats for the current user (sorted by last activity)
    list: protectedProcedure.handler(async ({ context }) => {
      try {
        const rows = await db
          .select({ id: chat.id, title: chat.title, lastMessageAt: chat.lastMessageAt, updatedAt: chat.updatedAt })
          .from(chat)
          .where(eq(chat.userId, context.session!.user.id))
          .orderBy(desc(chat.lastMessageAt), desc(chat.updatedAt));
        return rows;
		} catch {
			pruneUserChats(context.session!.user.id);
			const list = memChatsByUser.get(context.session!.user.id) ?? [];
			return list.map(({ id, title, lastMessageAt, updatedAt }) => ({ id, title, lastMessageAt, updatedAt }));
		}
	}),
    delete: protectedProcedure
      .input(z.object({ chatId: z.string().min(1) }))
      .handler(async ({ context, input }) => {
        const userId = context.session!.user.id;
        let removed = false;
        try {
          const deleted = await db
            .delete(chat)
            .where(and(eq(chat.id, input.chatId), eq(chat.userId, userId)))
            .returning({ id: chat.id });
          removed = deleted.length > 0;
          if (removed) {
            await db.delete(message).where(eq(message.chatId, input.chatId));
          }
        } catch (error) {
          console.error("chats.delete", error);
        }

		if (!removed) {
			const list = memChatsByUser.get(userId) ?? [];
			const idx = list.findIndex((row) => row.id === input.chatId);
			if (idx !== -1) {
				list.splice(idx, 1);
				memChatsByUser.set(userId, pruneChatList(list));
				removed = true;
			}
		}

        memMsgsByChat.delete(input.chatId);

		if (removed) {
			publish(`chats:index:${userId}`, "chats.index.remove", { chatId: input.chatId });
			publish(`chat:${input.chatId}`, "chat.removed", { chatId: input.chatId });
		}

        return { ok: removed } as const;
      }),
    rename: protectedProcedure
      .input(z.object({ chatId: z.string().min(1), title: z.string().min(1).max(120) }))
      .handler(async ({ context, input }) => {
        const userId = context.session!.user.id;
        const title = input.title.trim().slice(0, 120);
        if (!title) {
          return { ok: false as const };
        }
        const now = new Date();
        let updated = false;
        try {
          const res = await db
            .update(chat)
            .set({ title, updatedAt: now })
            .where(and(eq(chat.id, input.chatId), eq(chat.userId, userId)))
            .returning({ id: chat.id });
          updated = res.length > 0;
        } catch (error) {
          console.error("chats.rename", error);
        }

        if (!updated) {
          const list = memChatsByUser.get(userId) ?? [];
          const record = list.find((row) => row.id === input.chatId);
          if (!record) {
            return { ok: false as const };
          }
          record.title = title;
          record.updatedAt = now;
          memChatsByUser.set(userId, pruneChatList(list));
          updated = true;
        }

		if (updated) {
			publish(`chats:index:${userId}`, "chats.index.update", { chatId: input.chatId, title, updatedAt: now });
		}

		return { ok: updated } as const;
		}),
  },
  messages: {
    // List messages for a chat in ascending chronological order
    list: protectedProcedure
      .input(z.object({ chatId: z.string().min(1) }))
      .handler(async ({ context, input }) => {
        try {
          const owned = await db
            .select({ id: chat.id })
            .from(chat)
            .where(and(eq(chat.id, input.chatId), eq(chat.userId, context.session!.user.id)));
          if (owned.length === 0) return [];

          const msgs = await db
            .select({ id: message.id, role: message.role, content: message.content, createdAt: message.createdAt })
            .from(message)
            .where(eq(message.chatId, input.chatId))
            .orderBy(asc(message.createdAt));
          return msgs;
		} catch {
			const prunedMessages = pruneMessagesList(memMsgsByChat.get(input.chatId) ?? []);
			if (prunedMessages.length > 0) {
				memMsgsByChat.set(input.chatId, prunedMessages);
			} else {
				memMsgsByChat.delete(input.chatId);
			}
			const permissibleChats = pruneChatList(memChatsByUser.get(context.session!.user.id) ?? []);
			if (permissibleChats.length > 0) {
				memChatsByUser.set(context.session!.user.id, permissibleChats);
			}
			const hasAccess = permissibleChats.some((c) => c.id === input.chatId);
			if (!hasAccess) return [];
			return (memMsgsByChat.get(input.chatId) ?? prunedMessages)
				.map(({ id, role, content, createdAt }) => ({ id, role, content, createdAt }));
		}
	}),
    // Persist user message and optional assistant response
    send: protectedProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          userMessage: z.object({
            id: z.string().min(1).optional(),
            content: z.string().min(1),
            createdAt: z.union([z.string(), z.date()]).optional(),
          }),
          assistantMessage: z
            .object({
              id: z.string().min(1).optional(),
              content: z.string().min(1),
              createdAt: z.union([z.string(), z.date()]).optional(),
            })
            .optional(),
        }),
      )
      .handler(async ({ context, input }) => {
        const userCreatedAt = input.userMessage.createdAt ? new Date(input.userMessage.createdAt) : new Date();
        const assistantProvided = input.assistantMessage != null;
        const assistantCreatedAt = assistantProvided
          ? input.assistantMessage!.createdAt
            ? new Date(input.assistantMessage!.createdAt as string | Date)
            : new Date(userCreatedAt.getTime() + 1)
          : null;
        const userMsgId = input.userMessage.id ?? cuid();
        const assistantMsgId = assistantProvided ? input.assistantMessage!.id ?? cuid() : null;

        try {
          const owned = await db
            .select({ id: chat.id })
            .from(chat)
            .where(and(eq(chat.id, input.chatId), eq(chat.userId, context.session!.user.id)));
          if (owned.length === 0) return { ok: false as const };

          await db.insert(message).values({
            id: userMsgId,
            chatId: input.chatId,
            role: "user",
            content: input.userMessage.content,
            createdAt: userCreatedAt,
            updatedAt: userCreatedAt,
          });
          publish(
            `chat:${input.chatId}`,
            "chat.new",
            { chatId: input.chatId, messageId: userMsgId, role: "user", content: input.userMessage.content, createdAt: userCreatedAt },
          );

          let lastActivity = userCreatedAt;
          if (assistantProvided && assistantCreatedAt) {
            await db.insert(message).values({
              id: assistantMsgId!,
              chatId: input.chatId,
              role: "assistant",
              content: input.assistantMessage!.content,
              createdAt: assistantCreatedAt,
              updatedAt: assistantCreatedAt,
            });
            publish(
              `chat:${input.chatId}`,
              "chat.new",
              { chatId: input.chatId, messageId: assistantMsgId!, role: "assistant", content: input.assistantMessage!.content, createdAt: assistantCreatedAt },
            );
            lastActivity = assistantCreatedAt;
          }

          await db
            .update(chat)
            .set({ updatedAt: lastActivity, lastMessageAt: lastActivity })
            .where(eq(chat.id, input.chatId));
          publish(
            `chats:index:${context.session!.user.id}`,
            "chats.index.update",
            { chatId: input.chatId, updatedAt: lastActivity, lastMessageAt: lastActivity },
          );
          return { ok: true as const, userMessageId: userMsgId, assistantMessageId: assistantMsgId };
		} catch {
			pruneUserChats(context.session!.user.id);
			const userChats = memChatsByUser.get(context.session!.user.id) ?? [];
			if (!userChats.some((c) => c.id === input.chatId)) return { ok: false as const };
			addFallbackMessage(input.chatId, {
				id: userMsgId,
				chatId: input.chatId,
				role: "user",
				content: input.userMessage.content,
				createdAt: userCreatedAt,
				updatedAt: userCreatedAt,
			});
			publish(
				`chat:${input.chatId}`,
				"chat.new",
				{ chatId: input.chatId, messageId: userMsgId, role: "user", content: input.userMessage.content, createdAt: userCreatedAt },
			);
			if (assistantProvided && assistantCreatedAt) {
				addFallbackMessage(input.chatId, {
					id: assistantMsgId!,
					chatId: input.chatId,
					role: "assistant",
					content: input.assistantMessage!.content,
					createdAt: assistantCreatedAt,
					updatedAt: assistantCreatedAt,
				});
				publish(
					`chat:${input.chatId}`,
					"chat.new",
					{ chatId: input.chatId, messageId: assistantMsgId!, role: "assistant", content: input.assistantMessage!.content, createdAt: assistantCreatedAt },
				);
			}
			const owned = memChatsByUser.get(context.session!.user.id) ?? [];
			const record = owned.find((c) => c.id === input.chatId);
			if (record) {
				const latest = assistantCreatedAt ?? userCreatedAt;
				record.updatedAt = latest;
				record.lastMessageAt = latest;
			}
			memChatsByUser.set(context.session!.user.id, pruneChatList(owned));
			publish(
				`chats:index:${context.session!.user.id}`,
				"chats.index.update",
				{ chatId: input.chatId, updatedAt: assistantCreatedAt ?? userCreatedAt, lastMessageAt: assistantCreatedAt ?? userCreatedAt },
          );
          return { ok: true as const, userMessageId: userMsgId, assistantMessageId: assistantMsgId };
        }
      }),
    streamUpsert: protectedProcedure
      .input(
        z.object({
          chatId: z.string().min(1),
          messageId: z.string().min(1),
          role: z.enum(['user', 'assistant']),
          content: z.string().default(''),
          createdAt: z.union([z.string(), z.date()]).optional(),
          status: z.enum(['streaming', 'completed']).optional(),
        }),
      )
      .handler(async ({ context, input }) => {
        const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
        const now = new Date();
        const content = input.content ?? '';
        const status = input.status ?? 'streaming';
        const role = input.role;

        try {
          const owned = await db
            .select({ id: chat.id })
            .from(chat)
            .where(and(eq(chat.id, input.chatId), eq(chat.userId, context.session!.user.id)));
          if (owned.length === 0) return { ok: false as const };

          let inserted = false;
          try {
            await db.insert(message).values({
              id: input.messageId,
              chatId: input.chatId,
              role,
              content,
              createdAt,
              updatedAt: now,
            });
            inserted = true;
          } catch {
            await db
              .update(message)
              .set({ content, updatedAt: now })
              .where(eq(message.id, input.messageId));
          }

          const sidebarPayload: Record<string, unknown> = {
            chatId: input.chatId,
            updatedAt: role === 'assistant' ? now : createdAt,
          };

          if (role === 'assistant') {
            if (status === 'completed') {
              sidebarPayload['lastMessageAt'] = now;
              await db
                .update(chat)
                .set({ updatedAt: now, lastMessageAt: now })
                .where(eq(chat.id, input.chatId));
            } else {
              await db
                .update(chat)
                .set({ updatedAt: now })
                .where(eq(chat.id, input.chatId));
            }
          } else {
            sidebarPayload['lastMessageAt'] = createdAt;
            await db
              .update(chat)
              .set({ updatedAt: createdAt, lastMessageAt: createdAt })
              .where(eq(chat.id, input.chatId));
          }

          publish(
            `chats:index:${context.session!.user.id}`,
            'chats.index.update',
            sidebarPayload,
          );

          publish(
            `chat:${input.chatId}`,
            inserted ? 'chat.new' : 'chat.update',
            {
              chatId: input.chatId,
              messageId: input.messageId,
              role,
              content,
              status,
              createdAt,
              updatedAt: now,
            },
          );

          return { ok: true as const };
		} catch {
			pruneUserChats(context.session!.user.id);
			const userChats = memChatsByUser.get(context.session!.user.id) ?? [];
			if (!userChats.some((c) => c.id === input.chatId)) return { ok: false as const };

			const existingMessages = memMsgsByChat.get(input.chatId) ?? [];
			const existingIdx = existingMessages.findIndex((m) => m.id === input.messageId);
			if (existingIdx === -1) {
				addFallbackMessage(input.chatId, {
					id: input.messageId,
					chatId: input.chatId,
					role,
					content,
					createdAt,
					updatedAt: now,
				});
			} else {
				existingMessages[existingIdx] = {
					...existingMessages[existingIdx],
					role,
					content,
					updatedAt: now,
				};
				setFallbackMessages(input.chatId, existingMessages);
			}

			const record = userChats.find((c) => c.id === input.chatId);
			if (record) {
				if (role === 'assistant') {
					if (status === 'completed') {
						record.lastMessageAt = now;
					}
					record.updatedAt = now;
				} else {
					record.updatedAt = createdAt;
					record.lastMessageAt = createdAt;
				}
			}
			memChatsByUser.set(context.session!.user.id, pruneChatList(userChats));

          publish(
            `chat:${input.chatId}`,
            existingIdx == -1 ? 'chat.new' : 'chat.update',
            {
              chatId: input.chatId,
              messageId: input.messageId,
              role,
              content,
              status,
              createdAt,
              updatedAt: now,
            },
          );
          return { ok: true as const };
        }
      }),
  },
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
