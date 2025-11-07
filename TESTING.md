# Testing Strategy

This document outlines the testing strategy for OpenChat, including guidelines, patterns, and examples for writing effective tests.

## Testing Philosophy

**Goals:**
- Catch bugs before they reach production
- Document expected behavior through tests
- Enable confident refactoring
- Maintain high code quality
- Fast feedback during development

**Principles:**
- Test behavior, not implementation
- Write tests that resist refactoring
- Prefer integration over unit tests
- Test error cases and edge cases
- Keep tests simple and readable

## Testing Pyramid

```
         /\
        /  \  E2E Tests (Few)
       /----\
      / Int. \ Integration Tests (Some)
     /--------\
    /   Unit   \ Unit Tests (Many)
   /------------\
```

### Unit Tests (70%)
- Test individual functions and utilities
- Fast execution, no external dependencies
- Focus on business logic and algorithms
- Examples: validation, formatters, calculations

### Integration Tests (25%)
- Test multiple components working together
- May involve database, API calls
- Focus on user workflows
- Examples: API routes, form submissions

### End-to-End Tests (5%)
- Test complete user journeys
- Browser automation, full stack
- Critical user paths only
- Examples: sign up, create chat, send message

## Test Organization

```
apps/web/
├── src/
│   ├── lib/
│   │   ├── validation.ts
│   │   └── __tests__/
│   │       └── validation.test.ts
│   ├── components/
│   │   ├── chat/
│   │   │   ├── message.tsx
│   │   │   └── __tests__/
│   │   │       └── message.test.tsx
│   └── app/
│       └── api/
│           └── chats/
│               ├── route.ts
│               └── __tests__/
│                   └── route.test.ts
```

**Conventions:**
- Tests live in `__tests__` directory next to source
- Test files named `*.test.ts` or `*.test.tsx`
- One test file per source file
- Group related tests with `describe` blocks

## Testing Tools

### Vitest
- Fast unit test runner (used by OpenChat)
- Compatible with Jest API
- Built-in TypeScript support
- Instant feedback with watch mode

### React Testing Library
- Test React components from user perspective
- Query by accessible roles and labels
- Avoid testing implementation details

### Supertest
- HTTP assertion library for API testing
- Test Express/Next.js API routes
- Make requests, assert responses

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test validation.test.ts

# Run tests with coverage
bun test --coverage

# Run tests for specific workspace
cd apps/web && bun test
```

## Writing Good Tests

### Test Structure (AAA Pattern)

```typescript
describe('feature or component', () => {
  test('should do something when condition', () => {
    // Arrange - Set up test data and conditions
    const input = { name: 'Test' };

    // Act - Execute the code under test
    const result = someFunction(input);

    // Assert - Verify the result
    expect(result).toBe(expected);
  });
});
```

### Test Naming

**Good names:**
```typescript
test('should return validation error when title is empty')
test('should create chat with valid title')
test('should throw error when user is unauthorized')
```

**Bad names:**
```typescript
test('validation test')
test('it works')
test('test1')
```

### What to Test

**✅ Do Test:**
- Public API / exported functions
- User interactions (clicks, form submissions)
- Error handling and edge cases
- Integration between components
- Business logic and calculations

**❌ Don't Test:**
- Implementation details
- Third-party library internals
- Private functions (test through public API)
- Styles and CSS
- Trivial code (getters, setters)

### Common Patterns

#### Testing Pure Functions

```typescript
// validation.test.ts
import { describe, test, expect } from 'vitest';
import { chatTitleSchema } from '../validation';

describe('chatTitleSchema', () => {
  test('should accept valid title', () => {
    const result = chatTitleSchema.safeParse('My Chat');
    expect(result.success).toBe(true);
  });

  test('should reject empty title', () => {
    const result = chatTitleSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  test('should reject title longer than 200 characters', () => {
    const longTitle = 'a'.repeat(201);
    const result = chatTitleSchema.safeParse(longTitle);
    expect(result.success).toBe(false);
  });

  test('should trim whitespace from title', () => {
    const result = chatTitleSchema.safeParse('  My Chat  ');
    expect(result.data).toBe('My Chat');
  });
});
```

#### Testing React Components

```typescript
// message.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Message } from '../message';

describe('Message', () => {
  test('should render message content', () => {
    render(
      <Message
        content="Hello world"
        role="user"
        timestamp={new Date('2024-01-01')}
      />
    );

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  test('should show timestamp', () => {
    render(
      <Message
        content="Hello"
        role="assistant"
        timestamp={new Date('2024-01-01T12:00:00')}
      />
    );

    // Query by aria-label or test id
    expect(screen.getByLabelText(/sent at/i)).toBeInTheDocument();
  });

  test('should apply correct styles for user vs assistant', () => {
    const { rerender } = render(
      <Message content="Hello" role="user" timestamp={new Date()} />
    );

    const userMessage = screen.getByText('Hello').closest('div');
    expect(userMessage).toHaveClass('user-message');

    rerender(
      <Message content="Hello" role="assistant" timestamp={new Date()} />
    );

    const assistantMessage = screen.getByText('Hello').closest('div');
    expect(assistantMessage).toHaveClass('assistant-message');
  });
});
```

#### Testing API Routes

```typescript
// route.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '../route';

// Mock dependencies
vi.mock('@/lib/convex-server', () => ({
  getConvexUserFromSession: vi.fn(() => Promise.resolve([null, 'user_123'])),
  listChats: vi.fn(() => Promise.resolve({ chats: [], nextCursor: null })),
  createChatForUser: vi.fn((userId, title) =>
    Promise.resolve({ _id: 'chat_1', title, userId })
  ),
}));

describe('Chats API', () => {
  describe('GET /api/chats', () => {
    test('should return list of chats', async () => {
      const request = new Request('http://localhost:3000/api/chats');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('chats');
      expect(Array.isArray(data.chats)).toBe(true);
    });
  });

  describe('POST /api/chats', () => {
    test('should create chat with valid data', async () => {
      const request = new Request('http://localhost:3000/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.chat).toHaveProperty('_id');
      expect(data.chat.title).toBe('New Chat');
    });

    test('should reject invalid title', async () => {
      const request = new Request('http://localhost:3000/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('should handle rate limiting', async () => {
      // Make multiple requests quickly
      const requests = Array.from({ length: 15 }, () =>
        POST(new Request('http://localhost:3000/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test' }),
        }))
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
```

#### Testing Async Code

```typescript
// async-operations.test.ts
import { describe, test, expect } from 'vitest';
import { fetchUserData } from '../api';

describe('fetchUserData', () => {
  test('should return user data on success', async () => {
    const userId = 'user_123';
    const data = await fetchUserData(userId);

    expect(data).toHaveProperty('id', userId);
    expect(data).toHaveProperty('name');
  });

  test('should throw error when user not found', async () => {
    await expect(
      fetchUserData('invalid_id')
    ).rejects.toThrow('User not found');
  });

  test('should handle network errors', async () => {
    // Mock network failure
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    await expect(
      fetchUserData('user_123')
    ).rejects.toThrow('Network error');
  });
});
```

### Mocking

#### Mocking Modules

```typescript
import { vi } from 'vitest';

// Mock entire module
vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// Mock specific functions
vi.mock('@/lib/api', () => ({
  ...vi.importActual('@/lib/api'),
  fetchData: vi.fn(() => Promise.resolve({ data: 'mocked' })),
}));
```

#### Mocking fetch

```typescript
global.fetch = vi.fn((url) => {
  if (url.includes('/api/chats')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ chats: [] }),
    });
  }
  return Promise.reject(new Error('Unknown endpoint'));
});
```

#### Mocking timers

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('should call function after delay', () => {
  const callback = vi.fn();
  setTimeout(callback, 1000);

  vi.advanceTimersByTime(1000);

  expect(callback).toHaveBeenCalledOnce();
});
```

## Test Coverage

**Target coverage:**
- Overall: 70%+
- Critical paths: 90%+
- Utilities: 80%+
- UI components: 60%+

**Run coverage report:**
```bash
bun test --coverage
```

**Coverage reports:**
- HTML report: `coverage/index.html`
- Text summary in terminal

**What coverage doesn't tell you:**
- Whether you tested the right things
- Quality of your assertions
- Edge cases coverage
- Integration testing completeness

## Continuous Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Pull requests (CI pipeline)
- Before deployment

**CI Configuration:**
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test --coverage
      - uses: codecov/codecov-action@v3
```

## Testing Checklist

Before committing:
- [ ] All tests pass locally
- [ ] Added tests for new features
- [ ] Updated tests for changed behavior
- [ ] Tests cover error cases
- [ ] Tests are clear and maintainable
- [ ] No commented-out or skipped tests
- [ ] Coverage hasn't decreased

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Effective Snapshot Testing](https://kentcdodds.com/blog/effective-snapshot-testing)
