/**
 * Example test demonstrating how to use the test utilities
 *
 * This file shows best practices for using fixtures, mocks, and setup utilities
 * in your component and integration tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Window } from "happy-dom";

// Setup utilities
import { setupDom, cleanupDom, createMockLocalStorage } from "./setup-component";

// Fixtures
import {
  mockAuthenticatedUser,
  mockGuestUser,
  mockChatWithMessages,
  mockEmptyChat,
  mockUserMessage,
  mockAssistantMessage,
  createMockConversation,
  createMockMessage,
} from "./fixtures";

// Mocks
import {
  setupConvexMocks,
  mockConvexStore,
  createMockQueryWithArgs,
  createMockMutation,
  mockUseQuery,
  mockUseMutation,
} from "./mocks/convex";

import {
  setupOpenRouterMocks,
  createMockChatCompletionResponse,
  mockSuccessfulChatCompletion,
  createMockStreamChunks,
  createMockStreamingResponse,
  mockErrors,
} from "./mocks/openrouter";

// Mock Convex React hooks
vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: vi.fn(() => vi.fn()),
}));

describe("Example: Testing with Fixtures and Mocks", () => {
  let windowInstance: Window;

  beforeEach(() => {
    windowInstance = setupDom();
  });

  afterEach(() => {
    windowInstance.happyDOM.cancelAsync();
    cleanupDom();
    mockConvexStore.clear();
  });

  describe("User Fixtures", () => {
    it("provides realistic user data", () => {
      // Use predefined authenticated user
      expect(mockAuthenticatedUser.email).toBe("alice@example.com");
      expect(mockAuthenticatedUser.name).toBe("Alice Johnson");
      expect(mockAuthenticatedUser.encryptedOpenRouterKey).toBeDefined();

      // Use predefined guest user (no API key)
      expect(mockGuestUser.encryptedOpenRouterKey).toBeUndefined();
    });
  });

  describe("Chat Fixtures", () => {
    it("provides various chat states", () => {
      // Empty chat
      expect(mockEmptyChat.messageCount).toBe(0);

      // Chat with messages
      expect(mockChatWithMessages.messageCount).toBe(8);
      expect(mockChatWithMessages.lastMessageAt).toBeDefined();
    });
  });

  describe("Message Fixtures", () => {
    it("provides different message types", () => {
      // User message
      expect(mockUserMessage.role).toBe("user");
      expect(mockUserMessage.content).toBeDefined();

      // Assistant message
      expect(mockAssistantMessage.role).toBe("assistant");
      expect(mockAssistantMessage.status).toBe("completed");
    });

    it("creates conversations easily", () => {
      const conversation = createMockConversation(mockChatWithMessages._id, 3);

      // Should have 6 messages (3 user + 3 assistant)
      expect(conversation).toHaveLength(6);

      // First message should be from user
      expect(conversation[0].role).toBe("user");

      // Second message should be from assistant
      expect(conversation[1].role).toBe("assistant");
    });
  });

  describe("Convex Mocks", () => {
    it("mocks static query data", () => {
      // Setup mock data
      mockConvexStore.setQueryData("api.users.list", [
        mockAuthenticatedUser,
        mockGuestUser,
      ]);

      // Simulate useQuery hook
      const users = mockUseQuery({ _functionName: "api.users.list" } as any);

      expect(users).toHaveLength(2);
      expect(users[0].email).toBe("alice@example.com");
    });

    it("mocks dynamic query data based on arguments", () => {
      // Setup dynamic mock
      createMockQueryWithArgs("api.users.getByExternalId", (args) => {
        if (args.externalId === mockAuthenticatedUser.externalId) {
          return mockAuthenticatedUser;
        }
        return null;
      });

      // Query with matching external ID
      const user = mockUseQuery(
        { _functionName: "api.users.getByExternalId" } as any,
        { externalId: mockAuthenticatedUser.externalId }
      );

      expect(user).toBeDefined();
      expect(user?.email).toBe("alice@example.com");

      // Query with non-matching external ID
      const notFound = mockUseQuery(
        { _functionName: "api.users.getByExternalId" } as any,
        { externalId: "nonexistent" }
      );

      expect(notFound).toBeNull();
    });

    it("mocks mutations", async () => {
      // Setup mutation mock
      createMockMutation("api.chats.create", async (args) => {
        return createMockMessage({
          chatId: mockEmptyChat._id,
          content: args.title,
        })._id;
      });

      const createChat = mockUseMutation({ _functionName: "api.chats.create" } as any);
      const chatId = await createChat({ title: "New Chat" });

      expect(chatId).toBeDefined();
      expect(typeof chatId).toBe("string");
    });
  });

  describe("OpenRouter Mocks", () => {
    it("mocks successful chat completion", () => {
      const response = mockSuccessfulChatCompletion(
        "Hello, AI!",
        "anthropic/claude-4-sonnet"
      );

      expect(response.choices[0].message.role).toBe("assistant");
      expect(response.choices[0].message.content).toContain("Hello, AI!");
      expect(response.model).toBe("anthropic/claude-4-sonnet");
    });

    it("mocks streaming responses", () => {
      const chunks = createMockStreamChunks("Streaming text", {
        chunkSize: 5,
        reasoning: "Let me think...",
      });

      expect(chunks.length).toBeGreaterThan(3); // Should have multiple chunks

      // First chunk has role
      expect(chunks[0].choices[0].delta.role).toBe("assistant");

      // Some chunks have reasoning (OpenRouter uses reasoning_details array)
      const reasoningChunks = chunks.filter(
        c => c.choices[0].delta.reasoning_details
      );
      expect(reasoningChunks.length).toBeGreaterThan(0);

      // Last chunk has finish_reason
      expect(chunks[chunks.length - 1].choices[0].finish_reason).toBe("stop");
    });

    it("mocks error responses", () => {
      const error = mockErrors.invalidApiKey;

      expect(error.error.type).toBe("authentication_error");
      expect(error.error.code).toBe("invalid_api_key");
    });
  });

  describe("Integration: Component with Convex and OpenRouter", () => {
    beforeEach(() => {
      // Setup Convex data
      mockConvexStore.setQueryData("api.chats.get", mockChatWithMessages);
      mockConvexStore.setQueryData(
        "api.messages.list",
        createMockConversation(mockChatWithMessages._id, 2)
      );

      // Setup OpenRouter response
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => createMockChatCompletionResponse({
            content: "Mocked AI response",
          }),
        } as Response;
      });
    });

    it("demonstrates full integration testing pattern", async () => {
      // This is a placeholder test showing the pattern
      // In a real test, you would render your component here

      // Example of what you might do:
      // const { getByText, getByRole } = render(
      //   <ChatRoom chatId={mockChatWithMessages._id} />
      // );

      // Wait for data to load
      // await waitFor(() => {
      //   expect(getByText("Discussion about AI")).toBeDefined();
      // });

      // Interact with component
      // const input = getByRole("textbox");
      // fireEvent.change(input, { target: { value: "Test message" } });
      // fireEvent.submit(input.closest("form"));

      // Wait for AI response
      // await waitFor(() => {
      //   expect(getByText("Mocked AI response")).toBeDefined();
      // });

      // For now, just verify mocks are working
      const chat = mockUseQuery(
        { _functionName: "api.chats.get" } as any,
        { id: mockChatWithMessages._id }
      );
      expect(chat).toBeDefined();
      expect(chat.title).toBe("Discussion about AI");
    });
  });

  describe("localStorage Mocking", () => {
    it("mocks localStorage for testing", () => {
      const mockStorage = createMockLocalStorage();

      mockStorage.setItem("theme", "dark");
      expect(mockStorage.getItem("theme")).toBe("dark");

      mockStorage.removeItem("theme");
      expect(mockStorage.getItem("theme")).toBeNull();

      mockStorage.setItem("key1", "value1");
      mockStorage.setItem("key2", "value2");
      expect(mockStorage.length).toBe(2);

      mockStorage.clear();
      expect(mockStorage.length).toBe(0);
    });
  });
});
