# Writing Tests Guide

This guide provides best practices, common patterns, and utilities for writing effective tests in the OpenChat project.

## Table of Contents

- [General Principles](#general-principles)
- [Test Structure](#test-structure)
- [Unit Test Patterns](#unit-test-patterns)
- [Component Test Patterns](#component-test-patterns)
- [Integration Test Patterns](#integration-test-patterns)
- [E2E Test Patterns](#e2e-test-patterns)
- [Mock Utilities](#mock-utilities)
- [Common Patterns](#common-patterns)
- [Testing Async Code](#testing-async-code)
- [Error Testing](#error-testing)
- [Performance Testing](#performance-testing)
- [Accessibility Testing](#accessibility-testing)

## General Principles

### 1. Write Tests First (TDD)
Consider writing tests before implementation when:
- The requirements are clear
- The API contract is defined
- You're fixing a bug (write failing test first)

### 2. Test Behavior, Not Implementation
```typescript
// Bad: Testing implementation details
test("should call setState with new value", () => {
  const setState = vi.fn();
  component.setState = setState;
  component.handleChange("new");
  expect(setState).toHaveBeenCalledWith("new");
});

// Good: Testing user-visible behavior
test("should display updated value after input change", async () => {
  const user = userEvent.setup();
  render(<Component />);
  await user.type(screen.getByRole("textbox"), "new value");
  expect(screen.getByText("new value")).toBeInTheDocument();
});
```

### 3. Make Tests Readable
Tests serve as documentation. Use clear naming and structure:

```typescript
describe("RateLimiter", () => {
  describe("when request limit is exceeded", () => {
    test("should return limited=true", () => {
      // Arrange
      const limiter = new RateLimiter({ limit: 5, windowMs: 10000 });
      for (let i = 0; i < 5; i++) limiter.check("user-id");

      // Act
      const result = limiter.check("user-id");

      // Assert
      expect(result.limited).toBe(true);
    });
  });
});
```

### 4. Keep Tests Independent
Each test should be able to run independently:

```typescript
describe("UserService", () => {
  let service: UserService;

  beforeEach(() => {
    // Fresh instance for each test
    service = new UserService();
  });

  afterEach(() => {
    // Clean up
    service.cleanup();
  });

  test("test 1", () => {
    // This test doesn't depend on test 2
  });

  test("test 2", () => {
    // This test doesn't depend on test 1
  });
});
```

### 5. Use Meaningful Test Data
```typescript
// Bad: Generic test data
const user = { id: "1", name: "test" };

// Good: Realistic test data
const user = {
  id: "user-123-abc",
  name: "John Smith",
  email: "john.smith@example.com",
  createdAt: new Date("2024-01-15"),
};
```

## Test Structure

### Arrange-Act-Assert (AAA) Pattern
```typescript
test("should calculate total price with discount", () => {
  // Arrange: Set up test data and conditions
  const cart = new ShoppingCart();
  cart.addItem({ id: "1", price: 100, quantity: 2 });
  const discountCode = "SAVE10";

  // Act: Execute the behavior being tested
  const total = cart.calculateTotal(discountCode);

  // Assert: Verify the outcome
  expect(total).toBe(180); // 200 - 10% = 180
});
```

### Setup and Teardown
```typescript
describe("DatabaseService", () => {
  let db: Database;

  beforeAll(async () => {
    // Runs once before all tests in this describe block
    db = await connectToTestDatabase();
  });

  beforeEach(async () => {
    // Runs before each test
    await db.clear();
    await db.seed(testData);
  });

  afterEach(async () => {
    // Runs after each test
    await db.clear();
  });

  afterAll(async () => {
    // Runs once after all tests
    await db.disconnect();
  });

  test("example test", async () => {
    // Test code
  });
});
```

## Unit Test Patterns

### Testing Pure Functions
```typescript
// lib/validation.ts
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// lib/validation.test.ts
describe("validateEmail", () => {
  test("should return true for valid email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  test("should return false for email without @", () => {
    expect(validateEmail("userexample.com")).toBe(false);
  });

  test("should return false for email without domain", () => {
    expect(validateEmail("user@")).toBe(false);
  });

  test("should return false for empty string", () => {
    expect(validateEmail("")).toBe(false);
  });
});
```

### Testing Classes
```typescript
describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ limit: 5, windowMs: 10000 });
  });

  test("should allow first request", () => {
    const result = limiter.check("test-id");
    expect(result.limited).toBe(false);
    expect(result.count).toBe(1);
  });

  test("should block requests exceeding limit", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("test-id");
    }
    const result = limiter.check("test-id");
    expect(result.limited).toBe(true);
  });
});
```

### Testing with Mocks
```typescript
import { vi } from "vitest";

describe("UserService", () => {
  test("should fetch user from API", async () => {
    // Mock the API client
    const mockFetch = vi.fn().mockResolvedValue({
      id: "123",
      name: "John Doe",
    });

    const service = new UserService({ fetch: mockFetch });
    const user = await service.getUser("123");

    expect(mockFetch).toHaveBeenCalledWith("/api/users/123");
    expect(user.name).toBe("John Doe");
  });
});
```

### Testing Time-Dependent Code
```typescript
import { vi, beforeEach, afterEach } from "vitest";

describe("RateLimiter - Window Expiration", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.now() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should reset bucket after window expires", () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: 5000 });

    // Use up the limit
    for (let i = 0; i < 3; i++) {
      limiter.check("test-id");
    }
    expect(limiter.check("test-id").limited).toBe(true);

    // Advance time past window
    vi.setSystemTime(Date.now() + 5001);

    // Should allow requests again
    const result = limiter.check("test-id");
    expect(result.limited).toBe(false);
    expect(result.count).toBe(1);
  });
});
```

## Component Test Patterns

### Basic Component Rendering
```typescript
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

test("should render button with text", () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
});
```

### User Interactions
```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

test("should call onClick when button is clicked", async () => {
  const user = userEvent.setup();
  const handleClick = vi.fn();

  render(<Button onClick={handleClick}>Click me</Button>);

  await user.click(screen.getByRole("button"));

  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Testing Forms
```typescript
test("should submit form with entered data", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  render(<LoginForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText("Email"), "user@example.com");
  await user.type(screen.getByLabelText("Password"), "password123");
  await user.click(screen.getByRole("button", { name: "Sign In" }));

  expect(onSubmit).toHaveBeenCalledWith({
    email: "user@example.com",
    password: "password123",
  });
});
```

### Testing Async Component Updates
```typescript
import { render, screen, waitFor } from "@testing-library/react";

test("should display loading then data", async () => {
  render(<UserProfile userId="123" />);

  // Initially shows loading
  expect(screen.getByText("Loading...")).toBeInTheDocument();

  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  // Loading should be gone
  expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
});
```

### Testing Hooks
```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useOpenRouterKey } from "./use-openrouter-key";

test("should fetch and return API key", async () => {
  const { result } = renderHook(() => useOpenRouterKey());

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => {
    expect(result.current.hasKey).toBe(true);
  });

  expect(result.current.isLoading).toBe(false);
});
```

### Mocking Context
```typescript
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/contexts/theme";

test("should render with dark theme", () => {
  render(
    <ThemeProvider value={{ theme: "dark" }}>
      <Component />
    </ThemeProvider>
  );

  expect(screen.getByRole("main")).toHaveClass("dark");
});
```

## Integration Test Patterns

### Testing API Routes with MSW
```typescript
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("should return user data", async () => {
  server.use(
    http.get("/api/users/:id", ({ params }) => {
      return HttpResponse.json({
        id: params.id,
        name: "John Doe",
      });
    })
  );

  const response = await fetch("/api/users/123");
  const data = await response.json();

  expect(data.name).toBe("John Doe");
});
```

### Testing Streaming Responses
```typescript
test("should stream SSE events", async () => {
  const request = createChatRequest();
  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toContain("text/event-stream");

  const reader = response.body?.getReader();
  const chunks: string[] = [];

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    chunks.push(new TextDecoder().decode(value));
  }

  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks.some(chunk => chunk.includes("data:"))).toBe(true);
});
```

### Testing Database Operations
```typescript
import { convexTest } from "convex-test";
import schema from "./schema";

test("should create and retrieve user", async () => {
  const t = convexTest(schema);

  // Create user
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "John Doe",
      email: "john@example.com",
    });
  });

  // Retrieve user
  const user = await t.run(async (ctx) => {
    return await ctx.db.get(userId);
  });

  expect(user?.name).toBe("John Doe");
});
```

## E2E Test Patterns

### Basic Navigation and Interaction
```typescript
import { test, expect } from "@playwright/test";

test("user can navigate to settings", async ({ page }) => {
  await page.goto("/");

  await page.click('[data-testid="settings-button"]');

  await expect(page).toHaveURL(/.*settings/);
  await expect(page.locator("h1")).toHaveText("Settings");
});
```

### Testing Forms
```typescript
test("user can update profile", async ({ page }) => {
  await page.goto("/settings/profile");

  await page.fill('[name="name"]', "Jane Doe");
  await page.fill('[name="email"]', "jane@example.com");
  await page.click('button[type="submit"]');

  await expect(page.locator(".success-message")).toBeVisible();
  await expect(page.locator('[name="name"]')).toHaveValue("Jane Doe");
});
```

### Testing Authentication
```typescript
test("logged out user is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/.*login/);
});

test("user can sign in", async ({ page }) => {
  await page.goto("/login");

  await page.fill('[name="email"]', "user@example.com");
  await page.fill('[name="password"]', "password123");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
});
```

### Testing Real-time Features
```typescript
test("chat messages appear in real-time", async ({ page }) => {
  await page.goto("/chat");

  await page.fill('[data-testid="message-input"]', "Hello AI");
  await page.click('[data-testid="send-button"]');

  // User message appears
  await expect(page.locator('[data-testid="user-message"]').last())
    .toHaveText("Hello AI");

  // Wait for AI response
  await expect(page.locator('[data-testid="assistant-message"]').last())
    .toBeVisible({ timeout: 10000 });
});
```

## Mock Utilities

### Using Shared Mock Handlers

The project provides reusable mock handlers in `apps/web/test/mocks/`:

#### OpenRouter Mocks
```typescript
import {
  createStreamingHandler,
  createCompletionHandler,
  createErrorHandler,
} from "@/test/mocks/handlers";

beforeEach(() => {
  server.use(createStreamingHandler("Test response"));
});

test("handles OpenRouter errors", () => {
  server.use(createErrorHandler(401, "invalidApiKey"));
  // Test error handling
});
```

#### Convex Mocks
```typescript
import { mockConvexQuery, mockConvexMutation } from "@/test/mocks/convex";

vi.mock("convex/react", () => ({
  useQuery: mockConvexQuery,
  useMutation: mockConvexMutation,
}));
```

### Creating Custom Mocks
```typescript
// test/mocks/custom-service.ts
export function createMockUserService(overrides = {}) {
  return {
    getUser: vi.fn().mockResolvedValue({ id: "123", name: "John" }),
    updateUser: vi.fn().mockResolvedValue({ success: true }),
    deleteUser: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

// In test file
test("should call user service", async () => {
  const mockService = createMockUserService({
    getUser: vi.fn().mockResolvedValue({ id: "456", name: "Jane" }),
  });

  const result = await mockService.getUser("456");
  expect(result.name).toBe("Jane");
});
```

## Common Patterns

### Testing Error Boundaries
```typescript
test("should display error boundary on error", () => {
  const ThrowError = () => {
    throw new Error("Test error");
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

### Testing Keyboard Events
```typescript
test("should close modal on Escape key", async () => {
  const user = userEvent.setup();
  render(<Modal open={true} />);

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
```

### Testing Tooltips
```typescript
test("should show tooltip on hover", async () => {
  const user = userEvent.setup();
  render(<Button tooltip="Click to submit" />);

  await user.hover(screen.getByRole("button"));

  await waitFor(() => {
    expect(screen.getByRole("tooltip")).toHaveText("Click to submit");
  });
});
```

### Testing Debounced Functions
```typescript
import { vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("should debounce search input", async () => {
  const onSearch = vi.fn();
  const user = userEvent.setup({ delay: null }); // Disable userEvent delays

  render(<SearchInput onSearch={onSearch} />);

  await user.type(screen.getByRole("textbox"), "test");

  // Should not call immediately
  expect(onSearch).not.toHaveBeenCalled();

  // Fast-forward time
  vi.advanceTimersByTime(300);

  // Should call after debounce
  expect(onSearch).toHaveBeenCalledWith("test");
});
```

## Testing Async Code

### Using async/await
```typescript
test("should load and display data", async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

### Using waitFor
```typescript
import { waitFor } from "@testing-library/react";

test("should eventually display result", async () => {
  render(<AsyncComponent />);

  await waitFor(() => {
    expect(screen.getByText("Result")).toBeInTheDocument();
  }, { timeout: 5000 });
});
```

### Testing Race Conditions
```typescript
test("should handle rapid state changes", async () => {
  const { rerender } = render(<Component value="a" />);

  rerender(<Component value="b" />);
  rerender(<Component value="c" />);

  await waitFor(() => {
    expect(screen.getByText("c")).toBeInTheDocument();
  });
});
```

## Error Testing

### Testing Error Handling
```typescript
test("should handle API error gracefully", async () => {
  server.use(
    http.get("/api/data", () => {
      return HttpResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    })
  );

  render(<DataComponent />);

  await waitFor(() => {
    expect(screen.getByText(/error loading data/i)).toBeInTheDocument();
  });
});
```

### Testing Validation Errors
```typescript
test("should display validation error for invalid email", async () => {
  const user = userEvent.setup();
  render(<EmailForm />);

  await user.type(screen.getByLabelText("Email"), "invalid-email");
  await user.click(screen.getByRole("button", { name: "Submit" }));

  expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
});
```

## Performance Testing

### Testing Render Performance
```typescript
import { render } from "@testing-library/react";

test("should render large list efficiently", () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
  }));

  const start = performance.now();
  render(<VirtualList items={items} />);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(100); // Should render in under 100ms
});
```

### Testing Concurrent Requests
```typescript
test("should handle concurrent API calls", async () => {
  const promises = Array.from({ length: 10 }, (_, i) =>
    fetch(`/api/data/${i}`)
  );

  const responses = await Promise.all(promises);

  expect(responses.every(r => r.ok)).toBe(true);
});
```

## Accessibility Testing

### Testing Keyboard Navigation
```typescript
test("should be keyboard navigable", async () => {
  const user = userEvent.setup();
  render(<Menu />);

  await user.tab(); // Focus first item
  expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();

  await user.keyboard("{ArrowDown}"); // Move to next
  expect(screen.getAllByRole("menuitem")[1]).toHaveFocus();

  await user.keyboard("{Enter}"); // Activate
  expect(handleSelect).toHaveBeenCalled();
});
```

### Testing ARIA Attributes
```typescript
test("should have proper ARIA attributes", () => {
  render(<Dialog open={true} />);

  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveAttribute("aria-labelledby");
});
```

### Testing Screen Reader Announcements
```typescript
test("should announce loading state", () => {
  render(<LoadingSpinner />);

  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Loading");
  expect(status).toHaveAttribute("aria-live", "polite");
});
```

## Best Practices Summary

1. **Write descriptive test names** - Tests are documentation
2. **Keep tests focused** - One concept per test
3. **Use real user interactions** - Prefer userEvent over fireEvent
4. **Avoid testing implementation** - Test behavior and outcomes
5. **Mock external dependencies** - Keep tests fast and reliable
6. **Clean up after tests** - Prevent test pollution
7. **Use proper waiting strategies** - Don't use arbitrary timeouts
8. **Test error cases** - Not just the happy path
9. **Make tests maintainable** - DRY principle applies to tests too
10. **Run tests frequently** - Catch issues early

## Additional Resources

- [Testing Guide](./TESTING.md) - How to run tests
- [Test Coverage Guide](./TEST_COVERAGE.md) - Coverage requirements
- [Vitest Best Practices](https://vitest.dev/guide/best-practices.html)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about/#priority)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
