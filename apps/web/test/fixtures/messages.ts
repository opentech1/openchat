/**
 * Mock message fixtures for testing
 *
 * This module provides realistic mock message objects that match the Convex schema.
 * Includes messages in various states: user, assistant, with attachments, with reasoning, streaming, etc.
 *
 * @module fixtures/messages
 */

import type { Id, Doc } from "@server/convex/_generated/dataModel";
import type { ConvexFileAttachment } from "@/lib/convex-types";
import {
  MOCK_BASE_TIMESTAMP,
  mockAuthenticatedUser,
  mockGuestUser,
} from "./users";
import { mockChatWithMessages, mockLongConversation, mockEmptyChat } from "./chats";

/**
 * Mock user message (simple text)
 * This represents a basic message from the user
 */
export const mockUserMessage: Doc<"messages"> = {
  _id: "jm7msg001usersimple0001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-001",
  role: "user",
  content: "What is artificial intelligence?",
  createdAt: MOCK_BASE_TIMESTAMP,
  status: "completed",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock assistant message (simple response)
 * This represents a basic response from the AI assistant
 */
export const mockAssistantMessage: Doc<"messages"> = {
  _id: "jm7msg002assistsimple01" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 1000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-002",
  role: "assistant",
  content: "Artificial intelligence (AI) is the simulation of human intelligence processes by machines, especially computer systems. These processes include learning, reasoning, and self-correction.",
  createdAt: MOCK_BASE_TIMESTAMP + 1000,
  status: "completed",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock file attachment for testing
 */
export const mockFileAttachment: ConvexFileAttachment = {
  storageId: "jf7storage001file000001" as Id<"_storage">,
  filename: "document.pdf",
  contentType: "application/pdf",
  size: 1024768, // ~1MB
  uploadedAt: MOCK_BASE_TIMESTAMP,
  url: "https://storage.example.com/files/document.pdf",
};

/**
 * Mock image attachment for testing
 */
export const mockImageAttachment: ConvexFileAttachment = {
  storageId: "jf7storage002image00001" as Id<"_storage">,
  filename: "screenshot.png",
  contentType: "image/png",
  size: 524288, // 512KB
  uploadedAt: MOCK_BASE_TIMESTAMP + 500,
  url: "https://storage.example.com/images/screenshot.png",
};

/**
 * Mock user message with file attachment
 * This represents a message with an attached document
 */
export const mockUserMessageWithAttachment: Doc<"messages"> = {
  _id: "jm7msg003userattach001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 2000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-003",
  role: "user",
  content: "Can you analyze this document?",
  attachments: [mockFileAttachment],
  createdAt: MOCK_BASE_TIMESTAMP + 2000,
  status: "completed",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock user message with image attachment
 * This represents a message with an attached image
 */
export const mockUserMessageWithImage: Doc<"messages"> = {
  _id: "jm7msg004userimage0001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 3000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-004",
  role: "user",
  content: "What's in this image?",
  attachments: [mockImageAttachment],
  createdAt: MOCK_BASE_TIMESTAMP + 3000,
  status: "completed",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock user message with multiple attachments
 * This represents a message with several files attached
 */
export const mockUserMessageWithMultipleAttachments: Doc<"messages"> = {
  _id: "jm7msg005usermulti0001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 4000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-005",
  role: "user",
  content: "Compare these files",
  attachments: [mockFileAttachment, mockImageAttachment],
  createdAt: MOCK_BASE_TIMESTAMP + 4000,
  status: "completed",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock assistant message with reasoning (thinking process)
 * This represents a response from a reasoning-capable model like Claude 4 or DeepSeek R1
 */
export const mockAssistantMessageWithReasoning: Doc<"messages"> = {
  _id: "jm7msg006assistreason01" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 5000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-006",
  role: "assistant",
  content: "Based on my analysis, the optimal solution is to use a binary search tree with O(log n) lookup time. This provides the best balance between insertion speed and query performance for your use case.",
  reasoning: "Let me think through this step by step:\n1. First, I need to consider the data structure requirements\n2. The user needs fast lookups (suggesting hash map or BST)\n3. They also need ordered traversal (ruling out hash map)\n4. Binary search tree provides O(log n) for both operations\n5. This is optimal given the constraints",
  thinkingTimeMs: 2450, // 2.45 seconds of thinking
  createdAt: MOCK_BASE_TIMESTAMP + 5000,
  status: "completed",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock streaming message (in progress)
 * This represents a message that is currently being streamed
 */
export const mockStreamingMessage: Doc<"messages"> = {
  _id: "jm7msg007streaming0001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 6000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-007",
  role: "assistant",
  content: "Let me explain the concept of",
  createdAt: MOCK_BASE_TIMESTAMP + 6000,
  status: "streaming",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock pending message (waiting to be processed)
 * This represents a message that hasn't been sent to the AI yet
 */
export const mockPendingMessage: Doc<"messages"> = {
  _id: "jm7msg008pending000001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 7000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-008",
  role: "user",
  content: "Tell me about quantum computing",
  createdAt: MOCK_BASE_TIMESTAMP + 7000,
  status: "pending",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock error message (failed to process)
 * This represents a message that encountered an error
 */
export const mockErrorMessage: Doc<"messages"> = {
  _id: "jm7msg009error0000001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 8000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-009",
  role: "assistant",
  content: "I apologize, but I encountered an error processing your request.",
  createdAt: MOCK_BASE_TIMESTAMP + 8000,
  status: "error",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock long assistant message
 * This represents a lengthy, detailed response
 */
export const mockLongAssistantMessage: Doc<"messages"> = {
  _id: "jm7msg010longassist001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 9000,
  chatId: mockLongConversation._id,
  clientMessageId: "client-msg-010",
  role: "assistant",
  content: `# Machine Learning Fundamentals

Machine learning is a subset of artificial intelligence that focuses on developing systems that can learn from and make decisions based on data. Here are the key concepts:

## 1. Supervised Learning
In supervised learning, we train models on labeled data. The algorithm learns to map inputs to outputs based on example input-output pairs.

Common algorithms include:
- Linear Regression
- Logistic Regression
- Decision Trees
- Random Forests
- Support Vector Machines
- Neural Networks

## 2. Unsupervised Learning
Unsupervised learning works with unlabeled data, finding patterns and structures without explicit guidance.

Examples include:
- K-Means Clustering
- Hierarchical Clustering
- Principal Component Analysis (PCA)
- Autoencoders

## 3. Reinforcement Learning
The agent learns by interacting with an environment and receiving rewards or penalties for its actions.

This is particularly useful for:
- Game playing (AlphaGo, Chess engines)
- Robotics
- Autonomous driving
- Resource management

## Best Practices
1. Always split your data into training, validation, and test sets
2. Use cross-validation to assess model performance
3. Monitor for overfitting and underfitting
4. Feature engineering is crucial for model performance
5. Start simple and iterate

Would you like me to dive deeper into any of these topics?`,
  createdAt: MOCK_BASE_TIMESTAMP + 9000,
  status: "completed",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock system message
 * This represents a system-level message (rare but used for special purposes)
 */
export const mockSystemMessage: Doc<"messages"> = {
  _id: "jm7msg011system00001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 10000,
  chatId: mockEmptyChat._id,
  role: "system",
  content: "You are a helpful AI assistant specialized in technical topics.",
  createdAt: MOCK_BASE_TIMESTAMP + 10000,
  status: "completed",
};

/**
 * Mock deleted message (soft deleted)
 * This represents a message that has been deleted but still exists
 */
export const mockDeletedMessage: Doc<"messages"> = {
  _id: "jm7msg012deleted00001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 11000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-012",
  role: "user",
  content: "This message was deleted",
  createdAt: MOCK_BASE_TIMESTAMP + 11000,
  deletedAt: MOCK_BASE_TIMESTAMP + 12000,
  status: "completed",
  userId: mockAuthenticatedUser._id,
};

/**
 * Mock encrypted message
 * This represents a message with encrypted content
 */
export const mockEncryptedMessage: Doc<"messages"> = {
  _id: "jm7msg013encrypted001" as Id<"messages">,
  _creationTime: MOCK_BASE_TIMESTAMP + 13000,
  chatId: mockChatWithMessages._id,
  clientMessageId: "client-msg-013",
  role: "user",
  content: "enc_v1:U2FsdGVkX1+encrypted+content+here+base64",
  createdAt: MOCK_BASE_TIMESTAMP + 13000,
  status: "completed",
  userId: mockAuthenticatedUser._id,
};

/**
 * All mock messages as an array for easy iteration in tests
 */
export const mockMessages = [
  mockUserMessage,
  mockAssistantMessage,
  mockUserMessageWithAttachment,
  mockUserMessageWithImage,
  mockUserMessageWithMultipleAttachments,
  mockAssistantMessageWithReasoning,
  mockStreamingMessage,
  mockPendingMessage,
  mockErrorMessage,
  mockLongAssistantMessage,
  mockSystemMessage,
  mockDeletedMessage,
  mockEncryptedMessage,
];

/**
 * Get all active (non-deleted) messages
 */
export const mockActiveMessages = mockMessages.filter(msg => !msg.deletedAt);

/**
 * Get all user messages
 */
export const mockUserMessages = mockMessages.filter(msg => msg.role === "user" && !msg.deletedAt);

/**
 * Get all assistant messages
 */
export const mockAssistantMessages = mockMessages.filter(msg => msg.role === "assistant" && !msg.deletedAt);

/**
 * Helper to create a custom mock message with overrides
 *
 * @param overrides - Fields to override from the default user message
 * @returns Custom mock message
 *
 * @example
 * ```typescript
 * const customMessage = createMockMessage({
 *   role: "assistant",
 *   content: "Custom response"
 * });
 * ```
 */
export function createMockMessage(overrides: Partial<Doc<"messages">> = {}): Doc<"messages"> {
  const baseId = `jm7custom${Math.random().toString(36).substring(2, 15)}` as Id<"messages">;
  const now = Date.now();

  return {
    _id: baseId,
    _creationTime: now,
    chatId: mockChatWithMessages._id,
    clientMessageId: `client-msg-${Math.random().toString(36).substring(2, 10)}`,
    role: "user",
    content: "Test message",
    createdAt: now,
    status: "completed",
    userId: mockAuthenticatedUser._id,
    ...overrides,
  };
}

/**
 * Helper to get messages for a specific chat
 *
 * @param chatId - Chat ID to filter by
 * @returns Array of messages for the chat
 *
 * @example
 * ```typescript
 * const chatMessages = getMessagesByChatId(mockChatWithMessages._id);
 * ```
 */
export function getMessagesByChatId(chatId: Id<"chats">): Doc<"messages">[] {
  return mockMessages.filter(msg => msg.chatId === chatId && !msg.deletedAt);
}

/**
 * Helper to create a conversation (alternating user/assistant messages)
 *
 * @param chatId - Chat ID for the messages
 * @param exchanges - Number of user/assistant exchanges
 * @returns Array of messages forming a conversation
 *
 * @example
 * ```typescript
 * const conversation = createMockConversation(mockChatWithMessages._id, 3);
 * ```
 */
export function createMockConversation(chatId: Id<"chats">, exchanges: number): Doc<"messages">[] {
  const messages: Doc<"messages">[] = [];
  const baseTime = MOCK_BASE_TIMESTAMP;

  for (let i = 0; i < exchanges; i++) {
    // User message
    messages.push(createMockMessage({
      chatId,
      role: "user",
      content: `User question ${i + 1}`,
      createdAt: baseTime + i * 2000,
      _creationTime: baseTime + i * 2000,
    }));

    // Assistant message
    messages.push(createMockMessage({
      chatId,
      role: "assistant",
      content: `Assistant response ${i + 1}`,
      createdAt: baseTime + i * 2000 + 1000,
      _creationTime: baseTime + i * 2000 + 1000,
    }));
  }

  return messages;
}

/**
 * Helper to simulate updating a message's content (for streaming)
 *
 * @param message - Message to update
 * @param newContent - New content to append or set
 * @param append - Whether to append or replace content
 * @returns Updated message
 *
 * @example
 * ```typescript
 * const updated = updateMessageContent(mockStreamingMessage, " neural networks", true);
 * ```
 */
export function updateMessageContent(
  message: Doc<"messages">,
  newContent: string,
  append = false
): Doc<"messages"> {
  return {
    ...message,
    content: append ? message.content + newContent : newContent,
  };
}

/**
 * Helper to simulate completing a streaming message
 *
 * @param message - Message to complete
 * @returns Updated message with completed status
 *
 * @example
 * ```typescript
 * const completed = completeStreamingMessage(mockStreamingMessage);
 * ```
 */
export function completeStreamingMessage(message: Doc<"messages">): Doc<"messages"> {
  return {
    ...message,
    status: "completed",
  };
}
