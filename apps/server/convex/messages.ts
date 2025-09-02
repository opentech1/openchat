import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

export const getMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect();
  },
});

export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    model: v.optional(v.string()),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
    parentMessageId: v.optional(v.id("messages")),
    highlightedText: v.optional(v.string()),
    nodeStyle: v.optional(v.string()),
  },
  handler: async (ctx, { chatId, content, role, model, position, parentMessageId, highlightedText, nodeStyle }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) throw new Error("Chat not found");
    
    const messageId = await ctx.db.insert("messages", {
      chatId,
      userId: role === "user" ? "mock-user" : "assistant",
      content,
      role,
      model,
      createdAt: Date.now(),
      position,
      parentMessageId,
      highlightedText,
      nodeStyle,
    });
    
    await ctx.db.patch(chatId, {
      updatedAt: Date.now(),
    });
    
    return messageId;
  },
});

export const addAIResponse = action({
  args: {
    chatId: v.id("chats"),
    userMessage: v.string(),
  },
  handler: async (ctx, { chatId, userMessage }) => {
    const responses = [
      `I understand you're saying: "${userMessage}". That's interesting!`,
      `Thanks for sharing that. Let me think about "${userMessage}"...`,
      `Great point! "${userMessage}" is something worth discussing.`,
      `I see what you mean about "${userMessage}". Tell me more!`,
      `Regarding "${userMessage}", I'd love to help you with that.`,
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    await ctx.runMutation(api.messages.addAssistantMessage, {
      chatId,
      content: randomResponse,
    });
  },
});

export const addAssistantMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, { chatId, content }) => {
    return await ctx.db.insert("messages", {
      chatId,
      userId: "assistant",
      content,
      role: "assistant",
      createdAt: Date.now(),
    });
  },
});

export const updateMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, { messageId, content }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    
    // Update the message content
    await ctx.db.patch(messageId, {
      content,
    });
    
    // Also update the chat's updatedAt timestamp
    if (message.chatId) {
      await ctx.db.patch(message.chatId, {
        updatedAt: Date.now(),
      });
    }
    
    return messageId;
  },
});

export const updateNodePosition = mutation({
  args: {
    messageId: v.id("messages"),
    position: v.object({ x: v.number(), y: v.number() }),
  },
  handler: async (ctx, { messageId, position }) => {
    await ctx.db.patch(messageId, { position });
  },
});
