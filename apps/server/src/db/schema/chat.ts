import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const chat = sqliteTable("chat", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).default(false),
});

export const message = sqliteTable("message", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chat.id),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).default(false),
});

export const syncEvent = sqliteTable("sync_event", {
  id: text("id").primaryKey(),
  entityType: text("entity_type", { enum: ["user", "chat", "message"] }).notNull(),
  entityId: text("entity_id").notNull(),
  operation: text("operation", { enum: ["create", "update", "delete"] }).notNull(),
  data: text("data"), // JSON stringified data
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  userId: text("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  synced: integer("synced", { mode: "boolean" }).default(false),
});

export const device = sqliteTable("device", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  fingerprint: text("fingerprint").notNull().unique(),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const syncConfig = sqliteTable("sync_config", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  mode: text("mode", { enum: ["local-only", "cloud-only", "hybrid"] }).notNull().default("hybrid"),
  autoSync: integer("auto_sync", { mode: "boolean" }).default(true),
  syncInterval: integer("sync_interval").default(30000),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type Chat = typeof chat.$inferSelect;
export type Message = typeof message.$inferSelect;
export type SyncEvent = typeof syncEvent.$inferSelect;
export type Device = typeof device.$inferSelect;
export type SyncConfig = typeof syncConfig.$inferSelect;

export type InsertChat = typeof chat.$inferInsert;
export type InsertMessage = typeof message.$inferInsert;
export type InsertSyncEvent = typeof syncEvent.$inferInsert;
export type InsertDevice = typeof device.$inferInsert;
export type InsertSyncConfig = typeof syncConfig.$inferInsert;