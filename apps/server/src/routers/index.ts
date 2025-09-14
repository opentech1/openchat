import { protectedProcedure, publicProcedure } from "../lib/orpc";
import type { RouterClient } from "@orpc/server";
import { z } from "zod";
import { db } from "../db";
import { chat, message } from "../db/schema/chat";
import { and, desc, eq, asc } from "drizzle-orm";

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
        } catch {
          const list = memChatsByUser.get(context.session!.user.id) ?? [];
          list.push({ id, userId: context.session!.user.id, title: input?.title ?? "New Chat", createdAt: now, updatedAt: now, lastMessageAt: now });
          memChatsByUser.set(context.session!.user.id, list);
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
        const list = memChatsByUser.get(context.session!.user.id) ?? [];
        return list
          .slice()
          .sort((a, b) => (b.lastMessageAt?.getTime() ?? b.updatedAt.getTime()) - (a.lastMessageAt?.getTime() ?? a.updatedAt.getTime()))
          .map(({ id, title, lastMessageAt, updatedAt }) => ({ id, title, lastMessageAt, updatedAt }));
      }
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
          const list = memMsgsByChat.get(input.chatId) ?? [];
          return list
            .filter((m) => {
              const userChats = memChatsByUser.get(context.session!.user.id) ?? [];
              return userChats.some((c) => c.id === input.chatId);
            })
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(({ id, role, content, createdAt }) => ({ id, role, content, createdAt }));
        }
      }),
    // Send a user message and append a fake assistant response "test"
    send: protectedProcedure
      .input(z.object({ chatId: z.string().min(1), content: z.string().min(1) }))
      .handler(async ({ context, input }) => {
        const now = new Date();
        try {
          const owned = await db
            .select({ id: chat.id })
            .from(chat)
            .where(and(eq(chat.id, input.chatId), eq(chat.userId, context.session!.user.id)));
          if (owned.length === 0) return { ok: false as const };

          const userMsgId = cuid();
          await db.insert(message).values({
            id: userMsgId,
            chatId: input.chatId,
            role: "user",
            content: input.content,
            createdAt: now,
            updatedAt: now,
          });

          const asstMsgId = cuid();
          const asstNow = new Date(now.getTime() + 1);
          await db.insert(message).values({
            id: asstMsgId,
            chatId: input.chatId,
            role: "assistant",
            content: "test",
            createdAt: asstNow,
            updatedAt: asstNow,
          });

          await db.update(chat).set({ updatedAt: asstNow, lastMessageAt: asstNow }).where(eq(chat.id, input.chatId));
          return { ok: true as const, userMessageId: userMsgId, assistantMessageId: asstMsgId };
        } catch {
          // Memory fallback
          const userChats = memChatsByUser.get(context.session!.user.id) ?? [];
          if (!userChats.some((c) => c.id === input.chatId)) return { ok: false as const };
          const msgs = memMsgsByChat.get(input.chatId) ?? [];
          const userMsgId = cuid();
          msgs.push({ id: userMsgId, chatId: input.chatId, role: "user", content: input.content, createdAt: now, updatedAt: now });
          const asstMsgId = cuid();
          const asstNow = new Date(now.getTime() + 1);
          msgs.push({ id: asstMsgId, chatId: input.chatId, role: "assistant", content: "test", createdAt: asstNow, updatedAt: asstNow });
          memMsgsByChat.set(input.chatId, msgs);
          const c = userChats.find((c) => c.id === input.chatId)!;
          c.updatedAt = asstNow;
          c.lastMessageAt = asstNow;
          return { ok: true as const, userMessageId: userMsgId, assistantMessageId: asstMsgId };
        }
      }),
  },
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
