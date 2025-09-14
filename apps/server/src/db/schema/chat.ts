import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("chat_user_idx").on(t.userId),
    lastMsgIdx: index("chat_last_msg_idx").on(t.lastMessageAt),
  }),
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id").notNull(),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    chatIdx: index("message_chat_idx").on(t.chatId),
    chatCreatedIdx: index("message_chat_created_idx").on(t.chatId, t.createdAt),
  }),
);

