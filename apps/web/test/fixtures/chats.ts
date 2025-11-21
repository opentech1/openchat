/**
 * Mock chat fixtures for testing
 *
 * This module provides realistic mock chat objects that match the Convex schema.
 * Includes various chat states for comprehensive testing.
 *
 * @module fixtures/chats
 */

import type { Id, Doc } from "@server/convex/_generated/dataModel";
import { MOCK_BASE_TIMESTAMP, mockAuthenticatedUser, mockGuestUser, mockPowerUser } from "./users";

/**
 * Mock empty chat (newly created, no messages)
 * This represents a chat that was just created but hasn't had any messages yet
 */
export const mockEmptyChat: Doc<"chats"> = {
  _id: "jh7chat001empty000000001" as Id<"chats">,
  _creationTime: MOCK_BASE_TIMESTAMP,
  userId: mockAuthenticatedUser._id,
  title: "New Chat",
  createdAt: MOCK_BASE_TIMESTAMP,
  updatedAt: MOCK_BASE_TIMESTAMP,
  messageCount: 0,
};

/**
 * Mock chat with messages (active conversation)
 * This represents a typical chat with ongoing conversation
 */
export const mockChatWithMessages: Doc<"chats"> = {
  _id: "jh7chat002active00000001" as Id<"chats">,
  _creationTime: MOCK_BASE_TIMESTAMP + 1000,
  userId: mockAuthenticatedUser._id,
  title: "Discussion about AI",
  createdAt: MOCK_BASE_TIMESTAMP + 1000,
  updatedAt: MOCK_BASE_TIMESTAMP + 5000,
  lastMessageAt: MOCK_BASE_TIMESTAMP + 5000,
  messageCount: 8,
};

/**
 * Mock deleted chat (soft deleted)
 * This represents a chat that has been deleted but still exists in the database
 */
export const mockDeletedChat: Doc<"chats"> = {
  _id: "jh7chat003deleted000001" as Id<"chats">,
  _creationTime: MOCK_BASE_TIMESTAMP - 86400000,
  userId: mockAuthenticatedUser._id,
  title: "Old Discussion",
  createdAt: MOCK_BASE_TIMESTAMP - 86400000,
  updatedAt: MOCK_BASE_TIMESTAMP - 3600000,
  lastMessageAt: MOCK_BASE_TIMESTAMP - 7200000,
  deletedAt: MOCK_BASE_TIMESTAMP - 3600000, // Deleted 1 hour ago
  messageCount: 15,
};

/**
 * Mock chat with encrypted title
 * This represents a chat with an encrypted title for privacy
 */
export const mockEncryptedChat: Doc<"chats"> = {
  _id: "jh7chat004encrypted0001" as Id<"chats">,
  _creationTime: MOCK_BASE_TIMESTAMP + 2000,
  userId: mockAuthenticatedUser._id,
  title: "enc_v1:U2FsdGVkX1+1234567890abcdefghijklmnop",
  createdAt: MOCK_BASE_TIMESTAMP + 2000,
  updatedAt: MOCK_BASE_TIMESTAMP + 3000,
  lastMessageAt: MOCK_BASE_TIMESTAMP + 3000,
  messageCount: 3,
};

/**
 * Mock long conversation chat
 * This represents a chat with many messages over time
 */
export const mockLongConversation: Doc<"chats"> = {
  _id: "jh7chat005longconv00001" as Id<"chats">,
  _creationTime: MOCK_BASE_TIMESTAMP - 86400000 * 7, // Created 7 days ago
  userId: mockPowerUser._id,
  title: "Deep Dive into Machine Learning",
  createdAt: MOCK_BASE_TIMESTAMP - 86400000 * 7,
  updatedAt: MOCK_BASE_TIMESTAMP,
  lastMessageAt: MOCK_BASE_TIMESTAMP,
  messageCount: 142,
};

/**
 * Mock guest user chat
 * This represents a chat created by a guest user
 */
export const mockGuestChat: Doc<"chats"> = {
  _id: "jh7chat006guestchat001" as Id<"chats">,
  _creationTime: MOCK_BASE_TIMESTAMP + 3000,
  userId: mockGuestUser._id,
  title: "Quick Question",
  createdAt: MOCK_BASE_TIMESTAMP + 3000,
  updatedAt: MOCK_BASE_TIMESTAMP + 4000,
  lastMessageAt: MOCK_BASE_TIMESTAMP + 4000,
  messageCount: 2,
};

/**
 * Mock recent chat
 * This represents a very recent active chat
 */
export const mockRecentChat: Doc<"chats"> = {
  _id: "jh7chat007recent000001" as Id<"chats">,
  _creationTime: MOCK_BASE_TIMESTAMP + 10000,
  userId: mockAuthenticatedUser._id,
  title: "Help with code review",
  createdAt: MOCK_BASE_TIMESTAMP + 10000,
  updatedAt: MOCK_BASE_TIMESTAMP + 15000,
  lastMessageAt: MOCK_BASE_TIMESTAMP + 15000,
  messageCount: 5,
};

/**
 * Mock archived chat (old, inactive)
 * This represents a chat that hasn't been touched in a while
 */
export const mockArchivedChat: Doc<"chats"> = {
  _id: "jh7chat008archived0001" as Id<"chats">,
  _creationTime: MOCK_BASE_TIMESTAMP - 86400000 * 90, // Created 90 days ago
  userId: mockAuthenticatedUser._id,
  title: "Historical discussion from Q4",
  createdAt: MOCK_BASE_TIMESTAMP - 86400000 * 90,
  updatedAt: MOCK_BASE_TIMESTAMP - 86400000 * 60, // Last updated 60 days ago
  lastMessageAt: MOCK_BASE_TIMESTAMP - 86400000 * 60,
  messageCount: 25,
};

/**
 * All mock chats as an array for easy iteration in tests
 */
export const mockChats = [
  mockEmptyChat,
  mockChatWithMessages,
  mockDeletedChat,
  mockEncryptedChat,
  mockLongConversation,
  mockGuestChat,
  mockRecentChat,
  mockArchivedChat,
];

/**
 * Get all active (non-deleted) chats
 */
export const mockActiveChats = mockChats.filter(chat => !chat.deletedAt);

/**
 * Get all deleted chats
 */
export const mockDeletedChats = mockChats.filter(chat => chat.deletedAt !== undefined);

/**
 * Helper to create a custom mock chat with overrides
 *
 * @param overrides - Fields to override from the default empty chat
 * @returns Custom mock chat
 *
 * @example
 * ```typescript
 * const customChat = createMockChat({
 *   title: "Custom Chat",
 *   messageCount: 10
 * });
 * ```
 */
export function createMockChat(overrides: Partial<Doc<"chats">> = {}): Doc<"chats"> {
  const baseId = `jh7custom${Math.random().toString(36).substring(2, 15)}` as Id<"chats">;
  const now = Date.now();

  return {
    _id: baseId,
    _creationTime: now,
    userId: mockAuthenticatedUser._id,
    title: "Test Chat",
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    ...overrides,
  };
}

/**
 * Helper to get chats for a specific user
 *
 * @param userId - User ID to filter by
 * @returns Array of chats for the user
 *
 * @example
 * ```typescript
 * const userChats = getChatsByUserId(mockAuthenticatedUser._id);
 * ```
 */
export function getChatsByUserId(userId: Id<"users">): Doc<"chats">[] {
  return mockChats.filter(chat => chat.userId === userId && !chat.deletedAt);
}

/**
 * Helper to get a chat by ID
 *
 * @param chatId - Chat ID to search for
 * @returns Mock chat or undefined
 *
 * @example
 * ```typescript
 * const chat = getChatById(mockChatWithMessages._id);
 * ```
 */
export function getChatById(chatId: Id<"chats">): Doc<"chats"> | undefined {
  return mockChats.find(chat => chat._id === chatId);
}

/**
 * Helper to simulate updating a chat's last message time
 *
 * @param chat - Chat to update
 * @param timestamp - New timestamp (defaults to now)
 * @returns Updated chat
 *
 * @example
 * ```typescript
 * const updatedChat = updateChatLastMessage(mockChatWithMessages);
 * ```
 */
export function updateChatLastMessage(
  chat: Doc<"chats">,
  timestamp: number = Date.now()
): Doc<"chats"> {
  return {
    ...chat,
    lastMessageAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Helper to simulate incrementing a chat's message count
 *
 * @param chat - Chat to update
 * @param increment - Number to increment by (default: 1)
 * @returns Updated chat
 *
 * @example
 * ```typescript
 * const updatedChat = incrementMessageCount(mockEmptyChat, 2);
 * ```
 */
export function incrementMessageCount(chat: Doc<"chats">, increment = 1): Doc<"chats"> {
  return {
    ...chat,
    messageCount: (chat.messageCount ?? 0) + increment,
  };
}

/**
 * Helper to simulate soft-deleting a chat
 *
 * @param chat - Chat to delete
 * @param timestamp - Deletion timestamp (defaults to now)
 * @returns Updated chat
 *
 * @example
 * ```typescript
 * const deletedChat = softDeleteChat(mockEmptyChat);
 * ```
 */
export function softDeleteChat(chat: Doc<"chats">, timestamp: number = Date.now()): Doc<"chats"> {
  return {
    ...chat,
    deletedAt: timestamp,
    updatedAt: timestamp,
  };
}
