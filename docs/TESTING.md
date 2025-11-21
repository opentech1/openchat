# Testing Guide

This document describes how to run and organize tests in the OpenChat project.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Test Organization](#test-organization)
- [Test Naming Conventions](#test-naming-conventions)
- [Running E2E Tests](#running-e2e-tests)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Run all tests
bun test

# Run specific test types
bun test:unit           # Unit tests only
bun test:component      # Component tests only
bun test:integration    # Integration tests only
bun test:e2e           # E2E tests (requires setup)

# Run tests in watch mode
bun test:watch

# Run with coverage
bun test:coverage
```

## Test Types

OpenChat uses a comprehensive testing strategy with four distinct test types:

### 1. Unit Tests
- **Purpose**: Test individual functions, classes, and utilities in isolation
- **File Pattern**: `*.test.ts` or `test/**/*.spec.ts`
- **Environment**: Node.js
- **Timeout**: 10 seconds
- **Location**:
  - `apps/web/src/**/__tests__/**/*.test.ts`
  - `apps/server/convex/**/*.test.ts`
  - `apps/web/test/**/*.spec.ts`

**Example:**
```typescript
// apps/web/src/lib/rate-limit.test.ts
describe("RateLimiter", () => {
  test("should allow first request", () => {
    const limiter = new RateLimiter({ limit: 5, windowMs: 10000 });
    const result = limiter.check("test-id");
    expect(result.limited).toBe(false);
  });
});
```

### 2. Component Tests
- **Purpose**: Test React components with user interactions
- **File Pattern**: `*.component.test.tsx`
- **Environment**: happy-dom (browser simulation)
- **Timeout**: 15 seconds
- **Location**: `apps/web/src/components/**/*.component.test.tsx`

**Example:**
```typescript
// apps/web/src/components/model-selector.component.test.tsx
test("should open dropdown when button clicked", async () => {
  const user = userEvent.setup();
  render(<ModelSelector options={mockModels} />);

  await user.click(screen.getByRole("button"));

  await waitFor(() => {
    expect(screen.getByPlaceholderText("Search models...")).toBeInTheDocument();
  });
});
```

### 3. Integration Tests
- **Purpose**: Test API routes, database interactions, and service integration
- **File Pattern**: `*.integration.test.ts`
- **Environment**: Node.js with MSW for mocking external APIs
- **Timeout**: 30 seconds
- **Location**: `apps/web/src/app/api/**/*.integration.test.ts`

**Example:**
```typescript
// apps/web/src/app/api/chat/route.integration.test.ts
test("should stream assistant response successfully", async () => {
  const request = createChatRequest();
  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toContain("text/event-stream");
});
```

### 4. E2E Tests
- **Purpose**: Test complete user workflows in a real browser
- **Framework**: Playwright
- **Browsers**: Chromium, Firefox, WebKit
- **Timeout**: 60 seconds
- **Location**: `apps/web/e2e/**/*.spec.ts`

**Example:**
```typescript
// apps/web/e2e/chat.spec.ts
test("user can send a message and receive a response", async ({ page }) => {
  await page.goto("/");
  await page.fill('[data-testid="message-input"]', "Hello");
  await page.click('[data-testid="send-button"]');

  await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();
});
```

## Running Tests

### Run All Tests
```bash
# Sequential execution of all test types
bun test

# This runs:
# 1. Unit tests
# 2. Component tests
# 3. Integration tests
```

### Run Specific Test Types

#### Unit Tests
```bash
# Run all unit tests
bun test:unit

# Run specific test file
bun test:unit apps/web/src/lib/rate-limit.test.ts

# Run tests matching a pattern
bun test:unit --grep "RateLimiter"
```

#### Component Tests
```bash
# Run all component tests
bun test:component

# Run specific component test
bun test:component apps/web/src/components/model-selector.component.test.tsx

# Run with browser debugging
bun test:component --inspect
```

#### Integration Tests
```bash
# Run all integration tests
bun test:integration

# Run specific integration test
bun test:integration apps/web/src/app/api/chat/route.integration.test.ts

# Run with detailed output
bun test:integration --reporter=verbose
```

#### E2E Tests
```bash
# Run all E2E tests
bun test:e2e

# Run in specific browser
bun test:e2e --project=chromium
bun test:e2e --project=firefox
bun test:e2e --project=webkit

# Run in headed mode (see browser)
bun test:e2e --headed

# Run specific test file
bun test:e2e apps/web/e2e/chat.spec.ts

# Debug mode with Playwright Inspector
bun test:e2e --debug
```

### Watch Mode
```bash
# Run unit tests in watch mode
bun test:watch

# Watch specific file pattern
bun test:watch apps/web/src/lib
```

### Coverage
```bash
# Generate coverage report for unit tests
bun test:coverage

# View HTML coverage report
open coverage/unit/index.html
```

## Test Organization

### Directory Structure
```
apps/
├── web/
│   ├── src/
│   │   ├── __tests__/          # Unit tests for src files
│   │   │   ├── lib/
│   │   │   └── hooks/
│   │   ├── components/
│   │   │   └── *.component.test.tsx    # Component tests
│   │   ├── app/
│   │   │   └── api/
│   │   │       └── **/*.integration.test.ts  # API integration tests
│   │   └── lib/
│   │       └── *.test.ts       # Inline unit tests
│   ├── test/                   # Shared test utilities
│   │   ├── setup.ts           # Test setup/teardown
│   │   └── mocks/             # Mock utilities
│   │       ├── handlers.ts    # MSW handlers
│   │       ├── convex.ts      # Convex mocks
│   │       └── openrouter.ts  # OpenRouter mocks
│   └── e2e/                   # E2E tests
│       ├── setup/
│       │   └── auth.ts
│       └── *.spec.ts
└── server/
    └── convex/
        └── **/*.test.ts        # Convex function tests
```

### File Placement Rules

1. **Unit Tests**:
   - Place next to the file being tested: `file.ts` → `file.test.ts`
   - Or in `__tests__` directory: `lib/utils.ts` → `__tests__/lib/utils.test.ts`

2. **Component Tests**:
   - Always use `.component.test.tsx` suffix
   - Place in same directory as component

3. **Integration Tests**:
   - Always use `.integration.test.ts` suffix
   - Place next to the route file being tested

4. **E2E Tests**:
   - Place in `apps/web/e2e/` directory
   - Group by feature or user flow

## Test Naming Conventions

### File Naming

| Test Type | Pattern | Example |
|-----------|---------|---------|
| Unit | `*.test.ts` or `*.spec.ts` | `rate-limit.test.ts` |
| Component | `*.component.test.tsx` | `model-selector.component.test.tsx` |
| Integration | `*.integration.test.ts` | `route.integration.test.ts` |
| E2E | `*.spec.ts` (in e2e/) | `chat.spec.ts` |

### Test Description Naming

Use descriptive, behavior-focused test names:

```typescript
// Good: Describes behavior and expected outcome
test("should allow requests up to limit", () => {});
test("should block requests exceeding limit", () => {});
test("should reset bucket after window expires", () => {});

// Bad: Implementation-focused or vague
test("check function works", () => {});
test("test rate limiting", () => {});
test("it works", () => {});
```

### Describe Block Organization

```typescript
describe("ComponentName or FeatureName", () => {
  describe("Specific Aspect or Method", () => {
    test("should do something specific", () => {});
    test("should handle edge case", () => {});
  });

  describe("Another Aspect", () => {
    test("should behave correctly", () => {});
  });
});
```

Example:
```typescript
describe("ModelSelector Component", () => {
  describe("Rendering", () => {
    test("should render model selector button", () => {});
    test("should show selected model name", () => {});
  });

  describe("Keyboard Navigation", () => {
    test("should navigate down with arrow down key", () => {});
    test("should select model with enter key", () => {});
  });
});
```

## Running E2E Tests

### Prerequisites

1. **Install Playwright browsers** (first time only):
```bash
bunx playwright install
```

2. **Set environment variables**:
```bash
# Optional: Use different base URL
export BASE_URL=http://localhost:3000
```

### Local Development

```bash
# Start development server (required)
bun dev:web

# In another terminal, run E2E tests
bun test:e2e

# Or run both with headed mode to see the browser
bun test:e2e --headed
```

### Debug E2E Tests

```bash
# Open Playwright Inspector
bun test:e2e --debug

# Run specific test in debug mode
bun test:e2e chat.spec.ts --debug

# Generate trace for failed tests
bun test:e2e --trace on
```

### View Test Reports

```bash
# Run tests (generates HTML report on failure)
bun test:e2e

# Open the report
bunx playwright show-report
```

## Continuous Integration

Tests run automatically in CI on every push and pull request.

### CI Test Workflow
1. **Unit Tests** - Fast feedback (runs first)
2. **Component Tests** - UI component validation
3. **Integration Tests** - API and service integration
4. **Coverage Report** - Uploaded to Codecov
5. **E2E Tests** - Manual/scheduled (separate workflow)

### CI Commands
```yaml
# What runs in CI:
bun test:unit
bun test:component
bun test:integration
```

### Pull Request Requirements
- All tests must pass
- Code coverage must meet threshold (80%)
- No new test failures introduced

## Troubleshooting

### Tests Timing Out

**Problem**: Tests exceed timeout and fail

**Solutions**:
```typescript
// Increase timeout for specific test
test("slow operation", async () => {
  // test code
}, 30000); // 30 second timeout

// Or in describe block
describe("Slow Tests", () => {
  beforeAll(() => {
    vi.setConfig({ testTimeout: 30000 });
  });
});
```

### Mock Not Working

**Problem**: External API calls are being made instead of using mocks

**Solutions**:
1. Ensure MSW server is started:
```typescript
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
```

2. Check mock handlers are registered:
```typescript
server.use(
  http.post("/api/endpoint", () => {
    return HttpResponse.json({ data: "mocked" });
  })
);
```

### Component Test Fails in CI but Passes Locally

**Problem**: Different browser environment in CI

**Solutions**:
1. Check test setup file is being loaded:
```typescript
// vitest.config.component.ts
setupFiles: ["./test/setup.ts"]
```

2. Ensure async operations are awaited:
```typescript
await waitFor(() => {
  expect(element).toBeInTheDocument();
});
```

### E2E Tests Flaky

**Problem**: E2E tests pass sometimes but fail other times

**Solutions**:
1. Use proper waiting strategies:
```typescript
// Bad: Fixed waits
await page.waitForTimeout(1000);

// Good: Wait for specific conditions
await page.waitForSelector('[data-testid="message"]');
await expect(page.locator('[data-testid="message"]')).toBeVisible();
```

2. Increase timeout for slow operations:
```typescript
await expect(page.locator('[data-testid="result"]')).toBeVisible({
  timeout: 10000
});
```

### Coverage Not Generated

**Problem**: Coverage report is empty or missing

**Solutions**:
```bash
# Ensure coverage package is installed
bun add -d @vitest/coverage-v8

# Run with coverage flag
bun test:coverage

# Check coverage config in vitest.config.unit.ts
coverage: {
  provider: "v8",
  reportsDirectory: "./coverage/unit",
  reporter: ["text", "json", "html"],
}
```

### Tests Can't Find Modules

**Problem**: Import errors or "Cannot find module" errors

**Solutions**:
1. Check path aliases in vitest config:
```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "apps/web/src"),
    "@server": path.resolve(__dirname, "apps/server"),
  },
}
```

2. Ensure imports use correct aliases:
```typescript
// Good
import { helper } from "@/lib/utils";

// Bad (may not work in tests)
import { helper } from "../../lib/utils";
```

## Best Practices

1. **Keep tests fast**: Unit tests should run in milliseconds
2. **Use meaningful test data**: Avoid generic "test" or "foo" values
3. **Test behavior, not implementation**: Focus on what, not how
4. **One assertion per test** (when possible): Makes failures clearer
5. **Use descriptive test names**: Should read like documentation
6. **Clean up after tests**: Use `afterEach` to reset state
7. **Mock external dependencies**: Don't make real API calls
8. **Use test utilities**: Share common setup via helper functions

## Additional Resources

- [Writing Tests Guide](./WRITING_TESTS.md) - How to write effective tests
- [Test Coverage Guide](./TEST_COVERAGE.md) - Coverage requirements and best practices
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Documentation](https://testing-library.com/)
