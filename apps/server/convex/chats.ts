import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getChats = query({
  handler: async (ctx) => {
    // For now, return all chats (in production, filter by userId)
    return await ctx.db.query("chats").order("desc").collect();
  },
});

export const getChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    return await ctx.db.get(chatId);
  },
});

export const createChat = mutation({
  args: { 
    title: v.optional(v.string()),
    viewMode: v.optional(v.union(v.literal("chat"), v.literal("mindmap"))),
  },
  handler: async (ctx, { title, viewMode }) => {
    const now = Date.now();
    
    return await ctx.db.insert("chats", {
      userId: "mock-user", // Mock user for now
      title: title || (viewMode === "mindmap" ? "New Mind Map" : "New Chat"),
      createdAt: now,
      updatedAt: now,
      viewMode: viewMode || "chat",
    });
  },
});

export const updateChat = mutation({
  args: {
    chatId: v.id("chats"),
    title: v.string(),
  },
  handler: async (ctx, { chatId, title }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) {
      console.warn(`Chat ${chatId} not found for update`);
      return;
    }
    
    await ctx.db.patch(chatId, {
      title,
      updatedAt: Date.now(),
    });
  },
});

export const deleteChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) {
      console.warn(`Chat ${chatId} not found for deletion - may have been already deleted`);
      return; // Silently return if chat doesn't exist
    }
    
    // Delete all messages in the chat
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    // Delete the chat
    await ctx.db.delete(chatId);
  },
});

export const updateViewport = mutation({
  args: {
    chatId: v.id("chats"),
    viewport: v.object({
      x: v.number(),
      y: v.number(),
      zoom: v.number(),
    }),
  },
  handler: async (ctx, { chatId, viewport }) => {
    await ctx.db.patch(chatId, { viewport });
  },
});
