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
  },
  handler: async (ctx, { chatId, content }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) throw new Error("Chat not found");
    
    // Add user message
    const userMessageId = await ctx.db.insert("messages", {
      chatId,
      userId: "mock-user",
      content,
      role: "user",
      createdAt: Date.now(),
    });
    
    // Update chat's updatedAt
    await ctx.db.patch(chatId, {
      updatedAt: Date.now(),
    });
    
    // Schedule AI response
    await ctx.scheduler.runAfter(500, api.messages.addAIResponse, {
      chatId,
      userMessage: content,
    });
    
    return userMessageId;
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
