import { protectedProcedure } from "../lib/orpc";
import { db, chat, message, syncEvent, device } from "../db";
import { eq, and, gt, desc } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";

const createChatSchema = z.object({
  title: z.string().min(1),
});

const updateChatSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  isDeleted: z.boolean().optional(),
});

const createMessageSchema = z.object({
  chatId: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

const syncRequestSchema = z.object({
  lastSyncTimestamp: z.number().optional(),
  deviceId: z.string(),
});

export const chatRouter = {
  // Get user's chats
  getChats: protectedProcedure
    .input(syncRequestSchema.optional())
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;
      const lastSync = input?.lastSyncTimestamp || 0;

      const userChats = await db
        .select()
        .from(chat)
        .where(
          and(
            eq(chat.userId, userId),
            eq(chat.isDeleted, false),
            gt(chat.updatedAt, new Date(lastSync * 1000))
          )
        )
        .orderBy(desc(chat.updatedAt));

      return userChats;
    }),

  // Create a new chat
  createChat: protectedProcedure
    .input(createChatSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;
      const now = new Date();

      const newChat = {
        id: nanoid(),
        title: input.title,
        userId,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      await db.insert(chat).values(newChat);

      // Create sync event
      await db.insert(syncEvent).values({
        id: nanoid(),
        entityType: "chat",
        entityId: newChat.id,
        operation: "create",
        data: JSON.stringify(newChat),
        timestamp: now,
        userId,
        deviceId: "server",
        synced: true,
      });

      return newChat;
    }),

  // Update a chat
  updateChat: protectedProcedure
    .input(updateChatSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;
      const now = new Date();

      const updates: any = {
        updatedAt: now,
      };

      if (input.title !== undefined) updates.title = input.title;
      if (input.isDeleted !== undefined) updates.isDeleted = input.isDeleted;

      await db
        .update(chat)
        .set(updates)
        .where(and(eq(chat.id, input.id), eq(chat.userId, userId)));

      // Create sync event
      await db.insert(syncEvent).values({
        id: nanoid(),
        entityType: "chat",
        entityId: input.id,
        operation: "update",
        data: JSON.stringify({ id: input.id, ...updates }),
        timestamp: now,
        userId,
        deviceId: "server",
        synced: true,
      });

      return { success: true };
    }),

  // Delete a chat
  deleteChat: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;
      const now = new Date();

      await db
        .update(chat)
        .set({ isDeleted: true, updatedAt: now })
        .where(and(eq(chat.id, input.id), eq(chat.userId, userId)));

      // Also soft delete associated messages
      await db
        .update(message)
        .set({ isDeleted: true })
        .where(eq(message.chatId, input.id));

      // Create sync event
      await db.insert(syncEvent).values({
        id: nanoid(),
        entityType: "chat",
        entityId: input.id,
        operation: "delete",
        data: JSON.stringify({ id: input.id }),
        timestamp: now,
        userId,
        deviceId: "server",
        synced: true,
      });

      return { success: true };
    }),

  // Get messages for a chat
  getMessages: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        lastSyncTimestamp: z.number().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;
      const lastSync = input.lastSyncTimestamp || 0;

      // Verify user owns the chat
      const chatExists = await db
        .select()
        .from(chat)
        .where(and(eq(chat.id, input.chatId), eq(chat.userId, userId)))
        .limit(1);

      if (chatExists.length === 0) {
        throw new Error("Chat not found or access denied");
      }

      const chatMessages = await db
        .select()
        .from(message)
        .where(
          and(
            eq(message.chatId, input.chatId),
            eq(message.isDeleted, false),
            gt(message.createdAt, new Date(lastSync * 1000))
          )
        )
        .orderBy(message.createdAt);

      return chatMessages;
    }),

  // Create a new message
  createMessage: protectedProcedure
    .input(createMessageSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;
      const now = new Date();

      // Verify user owns the chat
      const chatExists = await db
        .select()
        .from(chat)
        .where(and(eq(chat.id, input.chatId), eq(chat.userId, userId)))
        .limit(1);

      if (chatExists.length === 0) {
        throw new Error("Chat not found or access denied");
      }

      const newMessage = {
        id: nanoid(),
        chatId: input.chatId,
        role: input.role,
        content: input.content,
        createdAt: now,
        isDeleted: false,
      };

      await db.insert(message).values(newMessage);

      // Create sync event
      await db.insert(syncEvent).values({
        id: nanoid(),
        entityType: "message",
        entityId: newMessage.id,
        operation: "create",
        data: JSON.stringify(newMessage),
        timestamp: now,
        userId,
        deviceId: "server",
        synced: true,
      });

      return newMessage;
    }),

  // Delete a message
  deleteMessage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;

      // Verify user owns the message (through chat ownership)
      const messageWithChat = await db
        .select({
          messageId: message.id,
          chatUserId: chat.userId,
        })
        .from(message)
        .innerJoin(chat, eq(message.chatId, chat.id))
        .where(eq(message.id, input.id))
        .limit(1);

      if (messageWithChat.length === 0 || messageWithChat[0].chatUserId !== userId) {
        throw new Error("Message not found or access denied");
      }

      const now = new Date();
      await db
        .update(message)
        .set({ isDeleted: true })
        .where(eq(message.id, input.id));

      // Create sync event
      await db.insert(syncEvent).values({
        id: nanoid(),
        entityType: "message",
        entityId: input.id,
        operation: "delete",
        data: JSON.stringify({ id: input.id }),
        timestamp: now,
        userId,
        deviceId: "server",
        synced: true,
      });

      return { success: true };
    }),

  // Get sync events (for pulling changes from server)
  getSyncEvents: protectedProcedure
    .input(syncRequestSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;
      const lastSync = input.lastSyncTimestamp || 0;

      const events = await db
        .select()
        .from(syncEvent)
        .where(
          and(
            eq(syncEvent.userId, userId),
            gt(syncEvent.timestamp, new Date(lastSync * 1000))
          )
        )
        .orderBy(syncEvent.timestamp);

      return events;
    }),

  // Register/update device for sync
  registerDevice: protectedProcedure
    .input(
      z.object({
        fingerprint: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;
      const now = new Date();

      try {
        // Try to insert new device
        const newDevice = {
          id: nanoid(),
          userId,
          fingerprint: input.fingerprint,
          lastSyncAt: null,
          createdAt: now,
        };

        await db.insert(device).values(newDevice);
        return newDevice;
      } catch (error) {
        // Device already exists, update it
        await db
          .update(device)
          .set({ userId, createdAt: now })
          .where(eq(device.fingerprint, input.fingerprint));

        const existingDevice = await db
          .select()
          .from(device)
          .where(eq(device.fingerprint, input.fingerprint))
          .limit(1);

        return existingDevice[0];
      }
    }),

  // Update last sync timestamp
  updateLastSync: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session!.user.id;
      const now = new Date();

      await db
        .update(device)
        .set({ lastSyncAt: now })
        .where(and(eq(device.fingerprint, input.deviceId), eq(device.userId, userId)));

      return { success: true };
    }),
};