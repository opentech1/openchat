# API Integration Tests

This directory contains comprehensive integration tests for the OpenChat API routes using MSW (Mock Service Worker) for HTTP mocking.

## Overview

The integration tests provide extensive coverage for:
- **POST /api/chat** - 60+ tests covering streaming, authentication, rate limiting, validation, and error handling
- **GET/POST /api/chats** - 50+ tests covering chat listing, creation, pagination, and CSRF protection
- **DELETE /api/chats/[id]** - 40+ tests covering chat deletion, ownership verification, and audit logging

## Test Structure

```
apps/web/src/app/api/
├── chat/
│   └── route.integration.test.ts    # 60+ tests for POST /api/chat
├── chats/
│   ├── route.integration.test.ts    # 50+ tests for GET/POST /api/chats
│   └── [id]/
│       └── route.integration.test.ts # 40+ tests for DELETE /api/chats/[id]
└── INTEGRATION_TESTS.md              # This file
```

## Running Tests

```bash
# Run all integration tests
npm run test

# Run specific test file
npm run test apps/web/src/app/api/chat/route.integration.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test -- --coverage
```

## MSW Setup

The tests use MSW (Mock Service Worker) to mock OpenRouter API responses. MSW handlers are located in:
```
apps/web/test/mocks/handlers.ts
```

### Available Handlers

- `createStreamingHandler(content, options)` - Mock streaming chat completions
- `createCompletionHandler(content, options)` - Mock non-streaming completions
- `createErrorHandler(statusCode, errorKey)` - Mock error responses
- `createTimeoutHandler(timeoutMs)` - Mock timeout scenarios

### Example Usage

```typescript
import { setupServer } from "msw/node";
import { createStreamingHandler } from "../../../../test/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("should stream response", async () => {
  server.use(createStreamingHandler("Test response"));

  const response = await POST(request);
  expect(response.status).toBe(200);
});
```

## Test Categories

### POST /api/chat (60+ tests)

#### Basic Functionality (7 tests)
- Streaming assistant responses
- User message handling
- Convex persistence
- SSE format validation
- Message ID handling
- Multi-message conversations

#### Authentication (2 tests)
- Unauthorized access rejection
- Valid authentication acceptance

#### Rate Limiting (4 tests)
- Excessive request throttling
- 429 status code
- Retry-After headers
- Rate limit headers

#### Request Validation (10 tests)
- Missing modelId/apiKey/chatId/messages
- Invalid JSON
- Oversized request body
- Too many messages
- Invalid content length
- Missing user message
- Valid request acceptance

#### OpenRouter Integration (7 tests)
- 401/429/502/504 error handling
- Network errors
- Model ID forwarding
- Message forwarding

#### Streaming Behavior (4 tests)
- Chunked streaming
- Stream completion
- Client disconnect handling
- Empty response handling

#### Reasoning Support (3 tests)
- Reasoning inclusion
- Reasoning-capable models
- Reasoning disablement

#### Attachments (4 tests)
- Image attachments
- Multiple attachments
- Oversized attachment rejection
- PDF attachments

#### CORS (3 tests)
- CORS headers in success/error responses
- Invalid origin rejection

#### Error Recovery (3 tests)
- Persistence failures
- Partial streaming failures
- Resource cleanup

#### Performance (2 tests)
- Response time validation
- Concurrent request handling

### GET/POST /api/chats (50+ tests)

#### GET - Basic Functionality (5 tests)
- Chat list retrieval
- Array response format
- Chat metadata inclusion
- Serialization
- Empty chat list

#### GET - Pagination (5 tests)
- Cursor-based pagination
- nextCursor handling
- First/subsequent page handling

#### GET - Sorting (3 tests)
- lastMessageAt sorting
- Sort order consistency
- Empty chat placement

#### GET - Authentication (2 tests)
- Authentication requirement
- User-specific chats

#### POST - Basic Functionality (6 tests)
- Chat creation
- Created chat response
- Default title handling
- Message count initialization
- Timestamp setting
- User assignment

#### POST - Validation (7 tests)
- Invalid JSON rejection
- Title length validation
- Valid title acceptance
- Whitespace trimming
- Empty title rejection
- Special character handling
- Unicode support

#### POST - Rate Limiting (5 tests)
- Excessive creation throttling
- 429 status code
- Retry-After header
- Rate limit headers
- Session-based limiting

#### POST - CSRF Protection (4 tests)
- CSRF token requirement
- Invalid token rejection
- Valid token acceptance
- Error messaging

#### POST - Authentication (2 tests)
- Authentication requirement
- User-specific creation

#### POST - Error Handling (3 tests)
- Database error handling
- Error messaging
- Error logging

#### POST - Concurrency (2 tests)
- Concurrent creation
- Data integrity

#### Performance (3 tests)
- GET response time
- Large list handling
- POST response time

### DELETE /api/chats/[id] (40+ tests)

#### Basic Functionality (4 tests)
- Successful deletion
- deleteChatForUser calls
- Success response format
- Message cascade deletion

#### Validation (6 tests)
- Invalid ID format rejection
- Empty ID rejection
- Long ID rejection
- Valid ID acceptance
- Hyphen/underscore support

#### CSRF Protection (5 tests)
- CSRF token requirement
- Invalid token rejection
- Valid token acceptance
- Cookie reading
- Header/cookie verification

#### Ownership Verification (3 tests)
- Owner-only deletion
- Non-owner rejection
- User ID verification

#### Authentication (3 tests)
- Authentication requirement
- Unauthenticated rejection
- Session user ID usage

#### Audit Logging (5 tests)
- Deletion logging
- User ID logging
- Chat ID logging
- IP address logging
- User agent logging

#### Error Handling (5 tests)
- Database error handling
- Error messaging
- Chat not found handling
- Error logging
- Network error handling

#### Idempotency (2 tests)
- Already deleted chat handling
- Multiple deletion attempts

#### Cascade Deletion (2 tests)
- Message deletion
- Metadata deletion

#### Performance (2 tests)
- Deletion speed
- Concurrent deletion

#### Security (4 tests)
- SQL injection prevention
- NoSQL injection prevention
- Input sanitization
- Path traversal prevention

#### Edge Cases (4 tests)
- Long title handling
- Special character handling
- Empty chat handling
- Attachment handling

## Mocking Strategy

### Authentication & Authorization
All tests mock authentication using `@/lib/auth-server`:
```typescript
vi.mock("@/lib/auth-server", () => ({
  getUserContext: vi.fn().mockResolvedValue({
    userId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
  }),
}));
```

### Database Operations
Convex operations are mocked using `@/lib/convex-server`:
```typescript
vi.mock("@/lib/convex-server", () => ({
  ensureConvexUser: vi.fn().mockResolvedValue("jd7abc123"),
  streamUpsertMessage: vi.fn().mockResolvedValue({ ok: true }),
  listChats: vi.fn().mockResolvedValue({ chats: [], nextCursor: null }),
}));
```

### External API Calls
OpenRouter API calls are mocked using MSW:
```typescript
server.use(
  createStreamingHandler("AI response", {
    reasoning: "Thinking process...",
  })
);
```

## Test Helpers

### Request Builders
Each test file includes helper functions to create test requests:

```typescript
// Chat streaming request
function createChatRequest(payload, headers) { ... }

// GET chats request
function createGetRequest(searchParams) { ... }

// POST chats request
function createPostRequest(body, headers) { ... }

// DELETE chat request
function createDeleteRequest(chatId, headers) { ... }
```

### SSE Stream Reader
For testing streaming responses:

```typescript
async function readSSEStream(response: Response): Promise<string[]> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }

  return chunks;
}
```

## Best Practices

### 1. Clean Up Between Tests
```typescript
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
```

### 2. Use Descriptive Test Names
```typescript
it("should reject request with invalid CSRF token", async () => {
  // Test implementation
});
```

### 3. Test Both Success and Failure Cases
```typescript
it("should accept valid CSRF token", async () => { ... });
it("should reject invalid CSRF token", async () => { ... });
```

### 4. Mock at the Right Level
- **Unit tests**: Mock individual functions
- **Integration tests**: Mock external services (OpenRouter, etc.)
- Keep Convex mocks but test actual route logic

### 5. Test Edge Cases
- Empty inputs
- Maximum length inputs
- Special characters
- Concurrent requests
- Network errors

### 6. Verify Side Effects
```typescript
it("should log errors for debugging", async () => {
  const { logError } = await import("@/lib/logger-server");

  // Trigger error
  await POST(request);

  expect(logError).toHaveBeenCalled();
});
```

## Coverage Goals

- **Line Coverage**: >90%
- **Branch Coverage**: >85%
- **Function Coverage**: >90%

Current coverage can be checked with:
```bash
npm run test -- --coverage
```

## Debugging Tests

### Enable Verbose Output
```bash
npm run test -- --reporter=verbose
```

### Run Specific Test
```bash
npm run test -- -t "should stream assistant response"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Integration Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test", "--", "--no-coverage"],
  "console": "integratedTerminal"
}
```

## Common Issues

### MSW Handler Not Matching
**Problem**: Request not intercepted by MSW
**Solution**: Ensure URL matches exactly, including protocol and query params

### Mock Not Resetting
**Problem**: Previous test affecting current test
**Solution**: Use `vi.clearAllMocks()` in `afterEach`

### Timeout Errors
**Problem**: Test timing out
**Solution**: Increase timeout in test or check for infinite loops

### Type Errors
**Problem**: TypeScript errors in mocks
**Solution**: Use `any` type or proper type assertions for test mocks

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Group related tests in describe blocks
3. Add comments for complex test scenarios
4. Update this README with new test categories
5. Ensure tests are deterministic (no race conditions)
6. Keep tests focused and atomic

## Resources

- [MSW Documentation](https://mswjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [OpenRouter API Docs](https://openrouter.ai/docs)

## Test Summary

| Endpoint | Test Count | Coverage Areas |
|----------|-----------|----------------|
| POST /api/chat | 60+ | Streaming, Auth, Rate Limiting, Validation, Errors, Reasoning, Attachments |
| GET /api/chats | 25+ | Listing, Pagination, Sorting, Auth |
| POST /api/chats | 25+ | Creation, Validation, CSRF, Rate Limiting |
| DELETE /api/chats/[id] | 40+ | Deletion, CSRF, Ownership, Audit, Security, Edge Cases |
| **Total** | **150+** | **Comprehensive API coverage** |
