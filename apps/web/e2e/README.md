# E2E Tests

End-to-end tests for the OpenChat web application using Playwright.

## Overview

This directory contains comprehensive E2E tests covering all critical user flows:

- **chat-flow.e2e.ts** (30+ tests) - Complete chat flow from login to sending messages and receiving responses
- **file-upload.e2e.ts** (20+ tests) - File upload functionality including images, previews, and attachments
- **model-switching.e2e.ts** (15+ tests) - Model selection and switching between different AI models
- **chat-export.e2e.ts** (15+ tests) - Exporting chats in different formats (Markdown, JSON, PDF)
- **error-recovery.e2e.ts** (10+ tests) - Error handling, retry functionality, and graceful degradation

## Prerequisites

1. **Playwright Installation**: Playwright should already be installed (check package.json)
2. **Test Environment**:
   - Development server must be running or will be started automatically
   - Test environment variables should be configured
3. **Authentication Setup**:
   - Tests require GitHub OAuth for authentication
   - You may need to configure test credentials or mock the OAuth flow

## Running Tests

### Run all E2E tests
```bash
bun test:e2e
```

### Run specific test file
```bash
bun playwright test apps/web/e2e/chat-flow.e2e.ts
```

### Run tests in headed mode (see browser)
```bash
bun playwright test --headed
```

### Run tests in debug mode
```bash
bun playwright test --debug
```

### Run tests in a specific browser
```bash
bun playwright test --project=chromium
bun playwright test --project=firefox
bun playwright test --project=webkit
```

### Run tests with UI mode (interactive)
```bash
bun playwright test --ui
```

## Test Configuration

Tests are configured in `/playwright.config.ts`:

- **Base URL**: http://localhost:3000 (configurable via BASE_URL env var)
- **Timeout**: 60 seconds per test
- **Retries**: 2 retries on CI, 0 locally
- **Web Server**: Automatically starts dev server before tests
- **Browsers**: Chromium, Firefox, WebKit

## Test Structure

### Setup Helpers (`setup/auth.ts`)
Common authentication and setup functions:
- `login(page)` - Authenticate user
- `logout(page)` - Sign out user
- `createNewChat(page)` - Create and navigate to new chat
- `waitForChatReady(page)` - Wait for chat interface to load
- `isAuthenticated(page)` - Check auth status

### Test Fixtures (`fixtures/`)
Test assets used in file upload tests:
- `test-image.png` - Sample PNG image
- `test-image.jpg` - Sample JPEG image
- `test-image.webp` - Sample WebP image

**Note**: You need to add actual image files to the `fixtures/` directory for file upload tests to work.

## Writing New Tests

Example test structure:

```typescript
import { test, expect } from "@playwright/test";
import { login, createNewChat, waitForChatReady } from "./setup/auth";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await createNewChat(page);
    await waitForChatReady(page);
  });

  test("should do something", async ({ page }) => {
    // Your test code here
    const element = page.getByRole("button", { name: /submit/i });
    await expect(element).toBeVisible();
  });
});
```

## Authentication Setup

The tests use GitHub OAuth for authentication. You need to either:

1. **Mock OAuth Flow**: Set up Playwright to intercept and mock the OAuth callback
2. **Use Test Account**: Configure a test GitHub account and OAuth app
3. **Set Auth Cookies**: Directly set authentication cookies in tests

Current implementation in `setup/auth.ts` is a placeholder. You'll need to implement one of the above approaches.

### Example: Setting Auth Cookies Directly

```typescript
await page.context().addCookies([{
  name: 'better_auth.session_token',
  value: 'your-test-session-token',
  domain: 'localhost',
  path: '/',
}]);
```

## CI/CD Integration

Tests are configured to run in CI with:
- Reduced parallelism (1 worker)
- 2 automatic retries
- HTML report generation

Add to your CI workflow:

```yaml
- name: Install Playwright Browsers
  run: bunx playwright install --with-deps

- name: Run E2E Tests
  run: bun test:e2e
  env:
    CI: true
    BASE_URL: http://localhost:3000

- name: Upload Test Report
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Debugging Failed Tests

### View HTML Report
```bash
bunx playwright show-report
```

### Run with trace
```bash
bun playwright test --trace on
```

### Open trace viewer
```bash
bunx playwright show-trace trace.zip
```

### Take screenshots on failure
Screenshots are automatically captured on test failure and included in the HTML report.

## Best Practices

1. **Use Semantic Selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Wait for Elements**: Use `await expect().toBeVisible()` instead of hard timeouts
3. **Isolate Tests**: Each test should be independent and not rely on state from other tests
4. **Clean Up**: Use `beforeEach` and `afterEach` to set up and tear down test state
5. **Mock External APIs**: Mock third-party API calls to make tests reliable and fast
6. **Test Data**: Use the `fixtures/` directory for test files and assets

## Known Issues

1. **Authentication**: OAuth flow is not fully implemented - tests may need manual auth setup
2. **File Fixtures**: Test image files need to be added to `fixtures/` directory
3. **API Responses**: Tests expect actual API responses - may need mocking for reliability
4. **Streaming Tests**: Some streaming response tests may be flaky due to timing

## Troubleshooting

### Tests fail with "element not found"
- Element selectors may need adjustment to match actual UI
- Check if elements are behind authentication
- Verify element is visible and not disabled

### Authentication fails
- Implement proper OAuth mocking or use test credentials
- Check that auth cookies are being set correctly
- Verify redirect URLs match test environment

### Timeout errors
- Increase timeout in playwright.config.ts
- Check that dev server is running
- Verify network requests aren't being blocked

### File upload tests fail
- Add actual test image files to `fixtures/` directory
- Ensure file paths are correct in tests
- Check file upload permissions

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
- [Playwright Inspector](https://playwright.dev/docs/inspector)
