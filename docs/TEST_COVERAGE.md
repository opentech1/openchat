# Test Coverage Guide

This document defines coverage requirements, what to test, what not to test, and how coverage is enforced in CI/CD.

## Table of Contents

- [Coverage Requirements](#coverage-requirements)
- [What to Test](#what-to-test)
- [What Not to Test](#what-not-to-test)
- [Coverage by Test Type](#coverage-by-test-type)
- [Measuring Coverage](#measuring-coverage)
- [CI/CD Coverage Enforcement](#cicd-coverage-enforcement)
- [Improving Coverage](#improving-coverage)
- [Coverage Exceptions](#coverage-exceptions)

## Coverage Requirements

### Target Coverage: 80%

OpenChat maintains a minimum code coverage target of **80%** across all test types:

- **Statements**: 80% minimum
- **Branches**: 80% minimum
- **Functions**: 80% minimum
- **Lines**: 80% minimum

### Coverage by Component

| Component | Target | Critical? |
|-----------|--------|-----------|
| Business Logic (`lib/`, `utils/`) | 90% | Yes |
| API Routes (`app/api/`) | 85% | Yes |
| Components (`components/`) | 75% | No |
| Hooks (`hooks/`) | 85% | Yes |
| Convex Functions (`convex/`) | 85% | Yes |
| Configuration Files | N/A | No |

## What to Test

### 1. Business Logic (MUST TEST - 90%+)

All business logic should have comprehensive unit tests:

```typescript
// lib/rate-limit.ts - Core rate limiting logic
export class RateLimiter {
  check(identifier: string): RateLimitResult {
    // Critical business logic - MUST be tested
  }
}
```

**Test Coverage:**
- ✅ Normal operation
- ✅ Edge cases (0, 1, max values)
- ✅ Boundary conditions
- ✅ Error conditions
- ✅ State transitions

### 2. API Routes (MUST TEST - 85%+)

All API endpoints should have integration tests:

```typescript
// app/api/chat/route.ts
export async function POST(request: Request) {
  // Critical API logic - MUST be tested
}
```

**Test Coverage:**
- ✅ Successful requests
- ✅ Validation errors
- ✅ Authentication/authorization
- ✅ Rate limiting
- ✅ Error handling
- ✅ Edge cases

### 3. Data Validation (MUST TEST - 95%+)

Input validation is security-critical:

```typescript
// lib/validation.ts
export function validateChatRequest(data: unknown): ChatRequest {
  // Security-critical validation - MUST be thoroughly tested
}
```

**Test Coverage:**
- ✅ Valid inputs
- ✅ Invalid inputs
- ✅ Malformed data
- ✅ Type mismatches
- ✅ Boundary values
- ✅ SQL/XSS injection attempts

### 4. Security Features (MUST TEST - 95%+)

Security features require extensive testing:

```typescript
// lib/csrf.ts
export function validateCsrfToken(token: string): boolean {
  // Security-critical - MUST be tested
}

// lib/encryption.ts
export function encrypt(data: string): string {
  // Security-critical - MUST be tested
}
```

**Test Coverage:**
- ✅ Normal operation
- ✅ Attack scenarios
- ✅ Edge cases
- ✅ Error handling
- ✅ Token expiration
- ✅ Invalid inputs

### 5. Utility Functions (MUST TEST - 90%+)

Pure utility functions should be thoroughly tested:

```typescript
// lib/utils.ts
export function formatCurrency(amount: number): string {
  // Pure function - easy and important to test
}
```

**Test Coverage:**
- ✅ Various input values
- ✅ Edge cases
- ✅ Invalid inputs
- ✅ Locale variations

### 6. Custom Hooks (MUST TEST - 85%+)

React hooks with business logic:

```typescript
// hooks/use-rate-limit.ts
export function useRateLimit(identifier: string) {
  // Contains logic - should be tested
}
```

**Test Coverage:**
- ✅ Initial state
- ✅ State updates
- ✅ Side effects
- ✅ Error handling
- ✅ Cleanup

### 7. Database Operations (MUST TEST - 85%+)

Convex queries and mutations:

```typescript
// convex/chats.ts
export const createChat = mutation({
  handler: async (ctx, args) => {
    // Database operations - should be tested
  },
});
```

**Test Coverage:**
- ✅ Successful operations
- ✅ Validation
- ✅ Error conditions
- ✅ Edge cases
- ✅ Data consistency

### 8. User-Facing Components (SHOULD TEST - 75%+)

Interactive components:

```typescript
// components/model-selector.tsx
export function ModelSelector({ options, onChange }) {
  // User interaction - should be tested
}
```

**Test Coverage:**
- ✅ Rendering
- ✅ User interactions
- ✅ State changes
- ✅ Error states
- ✅ Edge cases
- ⚠️ Styling (optional)

### 9. Error Handling (MUST TEST - 90%+)

Error handling logic:

```typescript
// lib/errors.ts
export function handleApiError(error: unknown): ErrorResponse {
  // Critical error handling - MUST be tested
}
```

**Test Coverage:**
- ✅ Different error types
- ✅ Error messages
- ✅ Error logging
- ✅ Recovery logic
- ✅ Fallback behavior

## What Not to Test

### 1. Third-Party Libraries (DON'T TEST)

Don't test external libraries - they have their own tests:

```typescript
// DON'T test Next.js, React, Convex internals
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
```

**Rationale:** Trust well-maintained libraries to work correctly.

### 2. Framework Boilerplate (DON'T TEST)

Don't test standard framework patterns:

```typescript
// app/layout.tsx - Standard Next.js layout
export default function RootLayout({ children }) {
  return <html>{children}</html>; // No business logic to test
}
```

**Rationale:** No custom logic, just framework conventions.

### 3. Type Definitions (DON'T TEST)

TypeScript provides compile-time checking:

```typescript
// types.ts - Type definitions only
export interface User {
  id: string;
  name: string;
  email: string;
}
```

**Rationale:** TypeScript compiler validates types.

### 4. Pure Presentational Components (OPTIONAL)

Simple components without logic:

```typescript
// components/avatar.tsx - Just renders props
export function Avatar({ src, alt }: AvatarProps) {
  return <img src={src} alt={alt} />;
}
```

**Rationale:** No logic to test, just visual presentation. Visual regression testing is better suited for these.

### 5. Constants and Enums (DON'T TEST)

Static configuration:

```typescript
// constants.ts
export const API_TIMEOUT = 30000;
export const MAX_MESSAGE_LENGTH = 4000;

export enum UserRole {
  Admin = "admin",
  User = "user",
}
```

**Rationale:** No behavior to test.

### 6. Simple Getters/Setters (DON'T TEST)

Trivial accessors:

```typescript
class User {
  private _name: string;

  get name() {
    return this._name; // Too trivial to test
  }

  set name(value: string) {
    this._name = value; // Too trivial to test
  }
}
```

**Rationale:** No logic, just property access.

### 7. Generated Code (DON'T TEST)

Auto-generated files:

```typescript
// convex/_generated/* - Generated by Convex
// Don't write tests for generated code
```

**Rationale:** Generated code is maintained by the framework.

### 8. Development/Debug Utilities (OPTIONAL)

Development-only code:

```typescript
// lib/debug.ts
export function logDebug(message: string) {
  if (process.env.NODE_ENV === "development") {
    console.log(message);
  }
}
```

**Rationale:** Not used in production, low value to test.

## Coverage by Test Type

### Unit Tests - Primary Coverage Driver

**Target:** 85% of business logic

```bash
bun test:coverage
```

Coverage includes:
- `lib/` utilities
- `convex/` functions
- Core business logic
- Validation functions
- Helper functions

**Excluded:**
- UI components
- API routes
- Integration points

### Component Tests - UI Coverage

**Target:** 75% of components

Component tests focus on user-visible behavior:
- Rendering
- User interactions
- State changes
- Accessibility

**Excluded:**
- Implementation details
- Styling
- Third-party component internals

### Integration Tests - API Coverage

**Target:** 85% of API routes

Integration tests cover:
- Request/response handling
- Authentication
- Rate limiting
- Error handling
- External API integration

**Excluded:**
- Unit-tested utilities (avoid duplication)
- Framework internals

### E2E Tests - Critical Paths

**Target:** 100% of critical user flows

E2E tests don't measure code coverage directly, but ensure:
- Authentication flow
- Chat functionality
- File uploads
- Settings management

## Measuring Coverage

### Generate Coverage Reports

```bash
# Unit test coverage
bun test:coverage

# View HTML report
open coverage/unit/index.html
```

### Coverage Report Structure

```
coverage/
├── unit/
│   ├── index.html          # Main coverage report
│   ├── lcov.info          # LCOV format for CI
│   └── coverage-final.json # JSON format
├── component/
│   └── ...
└── integration/
    └── ...
```

### Reading Coverage Reports

**Coverage Metrics:**
- **Statements**: Individual statements executed
- **Branches**: If/else paths taken
- **Functions**: Functions called
- **Lines**: Lines of code executed

**Color Coding:**
- 🟢 Green (80-100%): Good coverage
- 🟡 Yellow (50-79%): Needs improvement
- 🔴 Red (0-49%): Insufficient coverage

### Per-File Coverage

```bash
# Check specific file coverage
bun test:coverage --reporter=verbose

# Coverage for specific directory
bun test:coverage apps/web/src/lib
```

## CI/CD Coverage Enforcement

### Pull Request Requirements

**Every PR must:**
1. ✅ Pass all tests
2. ✅ Maintain or improve coverage
3. ✅ Meet 80% minimum threshold
4. ✅ No decrease in coverage

### Coverage Checks in CI

The test workflow (`test.yml`) enforces coverage:

```yaml
- name: Run unit tests with coverage
  run: bun test:unit --coverage

- name: Check coverage threshold
  run: |
    if [ $(cat coverage/unit/coverage-summary.json | jq '.total.lines.pct') -lt 80 ]; then
      echo "Coverage below 80% threshold"
      exit 1
    fi

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/unit/lcov.info
```

### Codecov Integration

Coverage reports are uploaded to Codecov for tracking:

- **Coverage trends**: Track coverage over time
- **Pull request comments**: See coverage impact
- **Coverage diff**: Changes in coverage per PR
- **Branch coverage**: Compare branches

### Failing Coverage Checks

**If coverage drops below 80%:**

1. CI build fails
2. PR cannot be merged
3. Codecov adds failing status
4. Team is notified

**To fix:**
- Add tests for uncovered code
- Remove dead code
- Justify exceptions (rare)

## Improving Coverage

### Finding Uncovered Code

```bash
# Generate HTML report
bun test:coverage

# Open in browser
open coverage/unit/index.html

# Look for red/yellow highlighted code
```

### Strategies to Improve Coverage

#### 1. Test Edge Cases

```typescript
// Add tests for edge cases
test("should handle empty array", () => {
  expect(processArray([])).toEqual([]);
});

test("should handle single item", () => {
  expect(processArray([1])).toEqual([1]);
});

test("should handle max items", () => {
  const large = Array.from({ length: 1000 }, (_, i) => i);
  expect(processArray(large).length).toBe(1000);
});
```

#### 2. Test Error Paths

```typescript
// Add tests for error handling
test("should throw on invalid input", () => {
  expect(() => validateEmail("invalid")).toThrow();
});

test("should handle network errors", async () => {
  server.use(createErrorHandler(500));
  await expect(fetchData()).rejects.toThrow();
});
```

#### 3. Test All Branches

```typescript
// Cover all if/else branches
test("should format large numbers with K suffix", () => {
  expect(formatNumber(1500)).toBe("1.5K");
});

test("should format small numbers without suffix", () => {
  expect(formatNumber(999)).toBe("999");
});

test("should format millions with M suffix", () => {
  expect(formatNumber(1500000)).toBe("1.5M");
});
```

#### 4. Remove Dead Code

```typescript
// Before: Dead code lowers coverage
function processData(data: Data) {
  if (data.legacy) {
    // This code is never called anymore
    return legacyProcess(data);
  }
  return modernProcess(data);
}

// After: Remove dead code
function processData(data: Data) {
  return modernProcess(data);
}
```

#### 5. Extract Testable Logic

```typescript
// Before: Hard to test
function ComplexComponent() {
  const data = useMemo(() => {
    // Complex calculation
    return items.filter(i => i.active)
      .map(i => ({ ...i, formatted: format(i) }))
      .sort((a, b) => a.order - b.order);
  }, [items]);

  return <div>{data.map(renderItem)}</div>;
}

// After: Extract and test separately
export function processItems(items: Item[]): ProcessedItem[] {
  return items
    .filter(i => i.active)
    .map(i => ({ ...i, formatted: format(i) }))
    .sort((a, b) => a.order - b.order);
}

function ComplexComponent() {
  const data = useMemo(() => processItems(items), [items]);
  return <div>{data.map(renderItem)}</div>;
}
```

## Coverage Exceptions

### When to Skip Coverage

Some code legitimately doesn't need tests:

#### 1. Debug/Development Code

```typescript
/* istanbul ignore next */
if (process.env.NODE_ENV === "development") {
  console.log("Debug info:", data);
}
```

#### 2. Unreachable Error Handlers

```typescript
try {
  await operation();
} catch (error) {
  /* istanbul ignore next */
  console.error("Should never happen:", error);
  throw error;
}
```

#### 3. Type Guards (already checked by TypeScript)

```typescript
/* istanbul ignore next */
if (typeof value !== "string") {
  throw new TypeError("Expected string");
}
```

### Documenting Exceptions

Add comment explaining why coverage is skipped:

```typescript
/* istanbul ignore next - Development only code */
if (process.env.DEBUG) {
  debugLog(state);
}
```

## Coverage Best Practices

1. **Write tests first** (TDD) - Coverage comes naturally
2. **Focus on behavior** - Not just lines of code
3. **Test critical paths** - Security, data, money operations
4. **Don't chase 100%** - 80-90% is ideal balance
5. **Quality over quantity** - Good tests > high percentage
6. **Review coverage regularly** - Track trends over time
7. **Fix coverage in same PR** - Don't accumulate debt
8. **Use coverage to find gaps** - Not as sole metric
9. **Test error cases** - Often missed in coverage
10. **Refactor for testability** - Extract complex logic

## Coverage Anti-Patterns

### ❌ Don't Write Tests Just for Coverage

```typescript
// Bad: Test adds no value
test("should have a name property", () => {
  const user = { name: "John" };
  expect(user.name).toBe("John"); // Obviously true
});
```

### ❌ Don't Test Implementation Details

```typescript
// Bad: Tests implementation
test("should call setState", () => {
  const setState = vi.fn();
  component.setState = setState;
  component.update();
  expect(setState).toHaveBeenCalled();
});

// Good: Tests behavior
test("should update display after change", async () => {
  render(<Component />);
  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Updated")).toBeInTheDocument();
});
```

### ❌ Don't Skip Edge Cases

```typescript
// Bad: Only happy path
test("should process data", () => {
  expect(process([1, 2, 3])).toEqual([2, 4, 6]);
});

// Good: Include edge cases
test("should process empty array", () => {
  expect(process([])).toEqual([]);
});

test("should handle single item", () => {
  expect(process([1])).toEqual([2]);
});
```

## Monitoring Coverage

### Coverage Trends

Track coverage over time:
- Check Codecov dashboard
- Monitor PRs for coverage changes
- Review coverage in retrospectives

### Coverage Goals

- **Current**: 80% minimum
- **Target**: 85% average
- **Critical code**: 90%+
- **New code**: 85%+ (enforced in CI)

### Coverage Metrics

Monitor these metrics:
- Overall coverage percentage
- Coverage by file/directory
- Uncovered lines count
- Coverage trend (up/down)
- New code coverage

## Additional Resources

- [Testing Guide](./TESTING.md) - How to run tests
- [Writing Tests Guide](./WRITING_TESTS.md) - How to write tests
- [Codecov Documentation](https://docs.codecov.com/)
- [Istanbul Coverage](https://istanbul.js.org/)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)
