# Test Utilities Documentation

This directory contains comprehensive test utilities, fixtures, and mocks for testing the OpenChat web application.

## Directory Structure

```
test/
├── setup-component.ts       # Component testing setup utilities
├── fixtures/                # Mock data fixtures
│   ├── users.ts            # User fixtures
│   ├── chats.ts            # Chat fixtures
│   ├── messages.ts         # Message fixtures
│   └── index.ts            # Centralized exports
├── mocks/                   # Mock implementations
│   ├── convex.ts           # Convex client mocks
│   ├── openrouter.ts       # OpenRouter API mocks
│   └── index.ts            # Centralized exports
└── README.md               # This file
```

## Quick Start

### Basic Component Test

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { setupDom, cleanupDom } from "../test/setup-component";
import { mockAuthenticatedUser } from "../test/fixtures";
import { mockConvexStore, mockUseQuery } from "../test/mocks";
import { Window } from "happy-dom";

describe("MyComponent", () => {
  let windowInstance: Window;

  beforeEach(() => {
    windowInstance = setupDom();
  });

  afterEach(() => {
    windowInstance.happyDOM.cancelAsync();
    cleanupDom();
  });

  it("renders user data", () => {
    // Setup mock data
    mockConvexStore.setQueryData("api.users.getByExternalId", mockAuthenticatedUser);

    // Render component
    const { getByText } = render(<MyComponent />);

    // Assert
    expect(getByText(mockAuthenticatedUser.name!)).toBeDefined();
  });
});
```

## Setup Utilities

### `setupDom()`

Creates a happy-dom environment for component testing. Sets up all necessary browser globals.

```typescript
const windowInstance = setupDom();
// ... run tests
windowInstance.happyDOM.cancelAsync();
```

### `cleanupDom()`

Removes all DOM globals created by `setupDom()`. Call this in `afterEach` to clean up.

```typescript
afterEach(() => {
  cleanupDom();
});
```

### `createMockLocalStorage()`

Creates an in-memory implementation of localStorage for testing.

```typescript
const mockStorage = createMockLocalStorage();
mockStorage.setItem("key", "value");
expect(mockStorage.getItem("key")).toBe("value");
```

### `createMockFetch()`

Creates a simple mock fetch function for testing API calls.

```typescript
globalThis.fetch = createMockFetch({ data: "test" }, { status: 200 });
const response = await fetch("/api/test");
const data = await response.json();
expect(data).toEqual({ data: "test" });
```

## Fixtures

### User Fixtures

Pre-defined user objects matching the Convex schema:

- **`mockAuthenticatedUser`** - Regular user with API key configured
- **`mockGuestUser`** - User without API key
- **`mockAdminUser`** - Admin user with elevated privileges
- **`mockBannedUser`** - Banned user
- **`mockNewUser`** - Newly registered user
- **`mockPowerUser`** - Heavy usage user

```typescript
import { mockAuthenticatedUser, createMockUser } from "../test/fixtures";

// Use predefined fixture
const user = mockAuthenticatedUser;

// Create custom user
const customUser = createMockUser({
  name: "Custom Name",
  email: "custom@example.com",
});
```

### Chat Fixtures

Pre-defined chat objects in various states:

- **`mockEmptyChat`** - New chat with no messages
- **`mockChatWithMessages`** - Active conversation
- **`mockDeletedChat`** - Soft-deleted chat
- **`mockEncryptedChat`** - Chat with encrypted title
- **`mockLongConversation`** - Chat with many messages
- **`mockGuestChat`** - Guest user's chat
- **`mockRecentChat`** - Recently active chat
- **`mockArchivedChat`** - Old inactive chat

```typescript
import { mockChatWithMessages, createMockChat } from "../test/fixtures";

// Use predefined fixture
const chat = mockChatWithMessages;

// Create custom chat
const customChat = createMockChat({
  title: "Custom Chat",
  messageCount: 10,
});

// Get chats for a specific user
const userChats = getChatsByUserId(mockAuthenticatedUser._id);
```

### Message Fixtures

Pre-defined message objects in various states:

- **`mockUserMessage`** - Simple user message
- **`mockAssistantMessage`** - AI assistant response
- **`mockUserMessageWithAttachment`** - Message with file
- **`mockUserMessageWithImage`** - Message with image
- **`mockAssistantMessageWithReasoning`** - Response with thinking process
- **`mockStreamingMessage`** - In-progress streaming message
- **`mockPendingMessage`** - Waiting to be processed
- **`mockErrorMessage`** - Failed message
- **`mockLongAssistantMessage`** - Lengthy detailed response

```typescript
import {
  mockUserMessage,
  mockAssistantMessageWithReasoning,
  createMockConversation,
} from "../test/fixtures";

// Use predefined fixtures
const message = mockUserMessage;
const reasoning = mockAssistantMessageWithReasoning;

// Create a conversation
const conversation = createMockConversation(mockChatWithMessages._id, 3);
// Creates 3 user/assistant message pairs

// Update message content (for streaming simulation)
const updated = updateMessageContent(mockStreamingMessage, " more text", true);
```

## Mocks

### Convex Mocks

Mock Convex client functions for testing without a real database.

#### Setup

```typescript
import { vi } from "vitest";
import { setupConvexMocks, mockConvexStore } from "../test/mocks";

// Automatic setup/teardown
describe("MyComponent", () => {
  setupConvexMocks(); // Adds beforeEach/afterEach

  it("loads data from Convex", () => {
    mockConvexStore.setQueryData("api.users.list", [mockUser1, mockUser2]);
    // ... test code
  });
});
```

#### Mock Queries

```typescript
import { mockConvexStore, createMockQueryWithArgs } from "../test/mocks";

// Simple static data
mockConvexStore.setQueryData("api.users.list", [mockUser1, mockUser2]);

// Dynamic data based on arguments
createMockQueryWithArgs("api.users.getByExternalId", (args) => {
  if (args.externalId === "user123") return mockAuthenticatedUser;
  return null;
});
```

#### Mock Mutations

```typescript
import { createMockMutation } from "../test/mocks";

createMockMutation("api.chats.create", async (args) => {
  return {
    _id: "jd7newchat123",
    title: args.title,
    userId: mockAuthenticatedUser._id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
  };
});
```

#### Mock Actions

```typescript
import { createMockAction } from "../test/mocks";

createMockAction("api.ai.generate", async (args) => {
  return { response: "Mock AI response to: " + args.message };
});
```

#### Mock Hooks

```typescript
import { vi } from "vitest";
import { mockUseQuery, mockUseMutation, mockUseAction } from "../test/mocks";

// Mock the Convex React hooks
vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
}));
```

### OpenRouter Mocks

Mock OpenRouter API responses for testing AI interactions.

#### Mock Models

```typescript
import {
  mockClaudeSonnetModel,
  mockGPT4Model,
  mockDeepSeekR1Model,
  mockModels,
} from "../test/mocks";

// Use individual models
const model = mockClaudeSonnetModel;

// Use all models
const allModels = mockModels;
```

#### Mock Chat Completions

```typescript
import {
  createMockChatCompletionResponse,
  mockSuccessfulChatCompletion,
  mockReasoningChatCompletion,
} from "../test/mocks";

// Simple completion
const response = mockSuccessfulChatCompletion(
  "Hello",
  "anthropic/claude-4-sonnet"
);

// Completion with reasoning
const reasoningResponse = mockReasoningChatCompletion(
  "Solve 2+2",
  "deepseek/deepseek-r1"
);

// Custom completion
const customResponse = createMockChatCompletionResponse({
  content: "Custom response",
  model: "anthropic/claude-4-sonnet",
  reasoning: "My thinking process...",
  promptTokens: 100,
  completionTokens: 50,
});
```

#### Mock Streaming Responses

```typescript
import {
  createMockStreamChunks,
  createMockStreamingResponse,
} from "../test/mocks";

// Create chunks
const chunks = createMockStreamChunks("Hello world", {
  chunkSize: 5,
  reasoning: "Let me think...",
});

// Create streaming response
const streamResponse = createMockStreamingResponse(chunks);
```

#### Mock Errors

```typescript
import { mockErrors, createMockErrorResponse } from "../test/mocks";

// Use predefined errors
const error = mockErrors.invalidApiKey;
const rateLimitError = mockErrors.rateLimitExceeded;

// Create custom error
const customError = createMockErrorResponse(
  "Custom error message",
  "custom_error",
  "custom_code"
);
```

#### Setup Fetch Mocking

```typescript
import { setupOpenRouterMocks, createMockOpenRouterFetch } from "../test/mocks";

describe("OpenRouter API", () => {
  setupOpenRouterMocks({
    models: mockModels,
    defaultResponse: createMockChatCompletionResponse(),
  });

  it("fetches models", async () => {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    const data = await response.json();
    expect(data.data).toEqual(mockModels);
  });
});

// Or manual setup
globalThis.fetch = createMockOpenRouterFetch({
  "/models": { data: mockModels },
  "/chat/completions": createMockChatCompletionResponse(),
});
```

## Advanced Usage

### Testing Component with Convex and OpenRouter

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { setupDom, cleanupDom } from "../test/setup-component";
import {
  mockAuthenticatedUser,
  mockChatWithMessages,
  createMockConversation,
} from "../test/fixtures";
import {
  setupConvexMocks,
  mockConvexStore,
  setupOpenRouterMocks,
  createMockChatCompletionResponse,
} from "../test/mocks";
import { Window } from "happy-dom";
import ChatRoom from "@/components/chat-room";

describe("ChatRoom", () => {
  let windowInstance: Window;

  beforeEach(() => {
    windowInstance = setupDom();

    // Setup Convex data
    mockConvexStore.setQueryData("api.chats.get", mockChatWithMessages);
    mockConvexStore.setQueryData(
      "api.messages.list",
      createMockConversation(mockChatWithMessages._id, 3)
    );

    // Setup OpenRouter response
    globalThis.fetch = createMockOpenRouterFetch({
      "/chat/completions": createMockChatCompletionResponse({
        content: "Test AI response",
      }),
    });
  });

  afterEach(() => {
    windowInstance.happyDOM.cancelAsync();
    cleanupDom();
    mockConvexStore.clear();
  });

  it("displays chat messages", async () => {
    render(<ChatRoom chatId={mockChatWithMessages._id} />);

    await waitFor(() => {
      expect(screen.getByText(/User question 1/)).toBeDefined();
      expect(screen.getByText(/Assistant response 1/)).toBeDefined();
    });
  });
});
```

### Testing Streaming Responses

```typescript
import { createMockStreamChunks, createMockStreamingResponse } from "../test/mocks";

it("handles streaming messages", async () => {
  const chunks = createMockStreamChunks("Streaming response text", {
    chunkSize: 5,
  });

  globalThis.fetch = vi.fn(async () => createMockStreamingResponse(chunks));

  // ... test streaming logic
});
```

## Tips and Best Practices

1. **Use setupConvexMocks()** - Automatically handles cleanup between tests
2. **Reset mocks between tests** - Use `beforeEach` to reset mock data
3. **Use fixtures over inline data** - Fixtures ensure consistency across tests
4. **Combine fixtures** - Use helper functions like `createMockConversation`
5. **Test error states** - Use `mockErrors` to test error handling
6. **Test streaming** - Use `createMockStreamChunks` for streaming tests
7. **Mock at the right level** - Mock Convex hooks for components, fetch for API tests

## TypeScript Support

All fixtures and mocks are fully typed with Convex schema types:

```typescript
import type { Doc, Id } from "@server/convex/_generated/dataModel";

// Fixtures return proper Convex types
const user: Doc<"users"> = mockAuthenticatedUser;
const chat: Doc<"chats"> = mockChatWithMessages;
const message: Doc<"messages"> = mockUserMessage;

// Type-safe IDs
const userId: Id<"users"> = mockAuthenticatedUser._id;
const chatId: Id<"chats"> = mockChatWithMessages._id;
```

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- path/to/test.spec.ts
```

## Contributing

When adding new fixtures or mocks:

1. Follow existing naming conventions (`mock*` for fixtures, `create*` for factories)
2. Add JSDoc documentation
3. Include usage examples
4. Export from index files
5. Update this README with new utilities

## Notes

- **MSW (Mock Service Worker)** is not currently installed. For HTTP mocking, the test utilities use fetch mocking. To use MSW:
  ```bash
  npm install -D msw
  ```

- **@testing-library/jest-dom** is not installed. For additional matchers, install it:
  ```bash
  npm install -D @testing-library/jest-dom
  ```
  Then import in your tests:
  ```typescript
  import '@testing-library/jest-dom';
  ```
