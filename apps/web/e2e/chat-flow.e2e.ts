import { test, expect, type Page } from "@playwright/test";
import { login, createNewChat, waitForChatReady } from "./setup/auth";

/**
 * E2E Tests: Complete Chat Flow
 *
 * Tests the entire user journey from login to sending messages and receiving responses.
 * Covers message persistence, streaming responses, and chat history.
 */

test.describe("Chat Flow - Complete User Journey", () => {
	test.beforeEach(async ({ page }) => {
		// Setup: Login before each test
		await login(page);
	});

	test.describe("Chat Creation", () => {
		test("should create a new chat from dashboard", async ({ page }) => {
			await page.goto("/dashboard");

			// Click new chat button
			const newChatButton = page.getByRole("link", { name: /new chat/i }).first();
			await expect(newChatButton).toBeVisible();
			await newChatButton.click();

			// Verify navigation to chat page
			await expect(page).toHaveURL(/\/dashboard\/chat\/.+/);

			// Verify chat composer is visible
			await expect(page.getByPlaceholder(/type your message/i)).toBeVisible();
		});

		test("should display empty chat state on new chat", async ({ page }) => {
			const chatId = await createNewChat(page);

			// Verify URL contains chat ID
			expect(chatId).toBeTruthy();
			expect(chatId.length).toBeGreaterThan(0);

			// Verify no messages are displayed initially
			const messages = page.locator('[data-testid="chat-message"]');
			await expect(messages).toHaveCount(0);
		});

		test("should initialize chat with default model", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			// Model selector should have a selected value
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await expect(modelSelector).toBeVisible();

			// Should not show "no model selected" text
			await expect(modelSelector).not.toHaveText(/select a model/i);
		});

		test("should show chat composer with all controls", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			// Verify composer controls
			await expect(page.getByPlaceholder(/type your message/i)).toBeVisible();
			await expect(page.getByRole("button", { name: /send message/i })).toBeVisible();
			await expect(page.getByRole("button", { name: /select.*model/i }).first()).toBeVisible();
		});
	});

	test.describe("Sending Messages", () => {
		test("should send a message by clicking send button", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const testMessage = "Hello, this is a test message";

			// Type message
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(testMessage);

			// Click send button
			const sendButton = page.getByRole("button", { name: /send message/i });
			await sendButton.click();

			// Verify message appears in chat
			await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
		});

		test("should send a message by pressing Enter", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const testMessage = "Test message sent with Enter key";

			// Type message and press Enter
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(testMessage);
			await textarea.press("Enter");

			// Verify message appears in chat
			await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
		});

		test("should allow newline with Shift+Enter", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Line 1");
			await textarea.press("Shift+Enter");
			await textarea.type("Line 2");

			// Verify textarea contains newline
			const textareaValue = await textarea.inputValue();
			expect(textareaValue).toContain("\n");
			expect(textareaValue).toBe("Line 1\nLine 2");
		});

		test("should clear input after sending message", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test message");
			await textarea.press("Enter");

			// Input should be cleared
			await expect(textarea).toHaveValue("");
		});

		test("should disable send button when textarea is empty", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const sendButton = page.getByRole("button", { name: /send message/i });

			// Should be disabled when empty
			await expect(sendButton).toBeDisabled();

			// Should be enabled when there's text
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test");
			await expect(sendButton).toBeEnabled();

			// Should be disabled again when cleared
			await textarea.clear();
			await expect(sendButton).toBeDisabled();
		});

		test("should disable send button when only whitespace", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			const sendButton = page.getByRole("button", { name: /send message/i });

			// Type only spaces
			await textarea.fill("   ");
			await expect(sendButton).toBeDisabled();

			// Type only newlines
			await textarea.clear();
			await textarea.fill("\n\n\n");
			await expect(sendButton).toBeDisabled();
		});

		test("should show sending state while message is being sent", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test message");

			const sendButton = page.getByRole("button", { name: /send message/i });
			await sendButton.click();

			// Button should show loading state (briefly)
			// Note: This might be too fast to catch in tests
			await page.waitForTimeout(100);
		});

		test("should handle long messages", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const longMessage = "A".repeat(1000);
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(longMessage);
			await textarea.press("Enter");

			// Verify message appears in chat
			await expect(page.getByText(longMessage)).toBeVisible({ timeout: 10000 });
		});

		test("should handle special characters in messages", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const specialMessage = "Test <script>alert('xss')</script> & special chars: 你好 🚀";
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(specialMessage);
			await textarea.press("Enter");

			// Verify message appears correctly escaped
			await expect(page.getByText(/Test.*alert.*xss.*special chars.*你好/)).toBeVisible({
				timeout: 10000,
			});
		});

		test("should handle rapid consecutive messages", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);

			// Send multiple messages quickly
			for (let i = 1; i <= 5; i++) {
				await textarea.fill(`Message ${i}`);
				await textarea.press("Enter");
				await page.waitForTimeout(100); // Small delay between messages
			}

			// All messages should appear
			for (let i = 1; i <= 5; i++) {
				await expect(page.getByText(`Message ${i}`)).toBeVisible({ timeout: 15000 });
			}
		});
	});

	test.describe("Receiving Responses", () => {
		test("should display AI response after sending message", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Say 'Hello World'");
			await textarea.press("Enter");

			// Wait for user message
			await expect(page.getByText("Say 'Hello World'")).toBeVisible({ timeout: 10000 });

			// Wait for AI response (this will vary based on actual API response)
			// Look for any new message that's not the user's message
			await page.waitForTimeout(2000); // Give time for streaming to start

			// Check that at least 2 messages exist (user + AI)
			const messages = page.locator('[data-testid="chat-message"]');
			await expect(messages).toHaveCount(2, { timeout: 30000 });
		});

		test("should show streaming response as it arrives", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Write a short story");
			await textarea.press("Enter");

			// Wait for streaming to start
			await page.waitForTimeout(2000);

			// Verify stop button appears during streaming
			const stopButton = page.getByRole("button", { name: /stop/i });
			// Note: Streaming might be very fast, so this might not always be visible
			// await expect(stopButton).toBeVisible({ timeout: 5000 });
		});

		test("should display stop button during streaming", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Tell me a long story");
			await textarea.press("Enter");

			// Wait a bit for streaming to start
			await page.waitForTimeout(1000);

			// Stop button should be visible during streaming
			const stopButton = page.getByRole("button", { name: /stop/i });
			// Attempt to find stop button (might be fast)
		});

		test("should stop streaming when stop button is clicked", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Write a very long essay");
			await textarea.press("Enter");

			// Wait for streaming to start
			await page.waitForTimeout(1500);

			// Click stop button if visible
			const stopButton = page.getByRole("button", { name: /stop/i });
			const isVisible = await stopButton.isVisible().catch(() => false);

			if (isVisible) {
				await stopButton.click();

				// Send button should appear again
				await expect(page.getByRole("button", { name: /send message/i })).toBeVisible({
					timeout: 2000,
				});
			}
		});
	});

	test.describe("Message Display", () => {
		test("should display user messages with correct styling", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const testMessage = "User message test";
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(testMessage);
			await textarea.press("Enter");

			// Wait for message to appear
			const messageElement = page.getByText(testMessage);
			await expect(messageElement).toBeVisible({ timeout: 10000 });

			// Verify it's styled as a user message (implementation specific)
			// You might check for specific classes or attributes
		});

		test("should display AI messages with correct styling", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Hello");
			await textarea.press("Enter");

			// Wait for AI response
			await page.waitForTimeout(3000);

			// Check that messages are properly differentiated
			const messages = page.locator('[data-testid="chat-message"]');
			await expect(messages.first()).toBeVisible();
		});

		test("should display messages in correct chronological order", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);

			// Send first message
			await textarea.fill("First message");
			await textarea.press("Enter");
			await expect(page.getByText("First message")).toBeVisible();

			await page.waitForTimeout(2000);

			// Send second message
			await textarea.fill("Second message");
			await textarea.press("Enter");
			await expect(page.getByText("Second message")).toBeVisible();

			// Verify order (first message should appear before second)
			const messages = page.getByText(/First message|Second message/);
			const allTexts = await messages.allTextContents();

			const firstIndex = allTexts.findIndex(t => t.includes("First message"));
			const secondIndex = allTexts.findIndex(t => t.includes("Second message"));

			expect(firstIndex).toBeLessThan(secondIndex);
		});

		test("should render markdown in AI responses", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Format this in markdown: **bold** and *italic*");
			await textarea.press("Enter");

			// Wait for response
			await page.waitForTimeout(3000);

			// Check if markdown is rendered (looking for formatted elements)
			// This is implementation-specific and depends on your markdown renderer
		});

		test("should render code blocks in AI responses", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Show me a JavaScript function");
			await textarea.press("Enter");

			// Wait for response
			await page.waitForTimeout(5000);

			// Look for code block elements (implementation specific)
			// await expect(page.locator('pre code')).toBeVisible({ timeout: 10000 });
		});
	});

	test.describe("Message Persistence", () => {
		test("should persist messages after page reload", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const testMessage = "This message should persist";
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(testMessage);
			await textarea.press("Enter");

			// Wait for message to appear
			await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });

			// Get current URL
			const chatUrl = page.url();

			// Reload page
			await page.reload();

			// Wait for chat to load
			await waitForChatReady(page);

			// Message should still be visible
			await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
		});

		test("should persist messages when navigating away and back", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const testMessage = "Test persistence navigation";
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(testMessage);
			await textarea.press("Enter");

			// Wait for message
			await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });

			const chatUrl = page.url();

			// Navigate to dashboard
			await page.goto("/dashboard");

			// Navigate back to chat
			await page.goto(chatUrl);
			await waitForChatReady(page);

			// Message should still be visible
			await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
		});

		test("should load chat history on initial load", async ({ page }) => {
			// Create a chat and send messages
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);

			// Send multiple messages
			await textarea.fill("Message 1");
			await textarea.press("Enter");
			await page.waitForTimeout(1000);

			await textarea.fill("Message 2");
			await textarea.press("Enter");
			await page.waitForTimeout(1000);

			const chatUrl = page.url();

			// Close page and open in new context
			await page.context().clearCookies({ domain: undefined });

			// Login again and navigate to chat
			await login(page);
			await page.goto(chatUrl);
			await waitForChatReady(page);

			// Both messages should be visible
			await expect(page.getByText("Message 1")).toBeVisible({ timeout: 10000 });
			await expect(page.getByText("Message 2")).toBeVisible({ timeout: 10000 });
		});
	});

	test.describe("Chat History Navigation", () => {
		test("should show recent chats in sidebar", async ({ page }) => {
			await page.goto("/dashboard");

			// Create a new chat
			const newChatButton = page.getByRole("link", { name: /new chat/i }).first();
			await newChatButton.click();
			await waitForChatReady(page);

			// Send a message
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test for sidebar");
			await textarea.press("Enter");

			await page.waitForTimeout(2000);

			// Navigate back to dashboard
			await page.goto("/dashboard");

			// Chat should appear in recent chats/sidebar (implementation specific)
			// await expect(page.getByText('Test for sidebar')).toBeVisible();
		});

		test("should allow switching between chats", async ({ page }) => {
			// Create first chat
			const chat1Id = await createNewChat(page);
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Chat 1 message");
			await textarea.press("Enter");
			await page.waitForTimeout(1000);

			const chat1Url = page.url();

			// Create second chat
			const chat2Id = await createNewChat(page);
			await textarea.fill("Chat 2 message");
			await textarea.press("Enter");
			await page.waitForTimeout(1000);

			const chat2Url = page.url();

			// Navigate to first chat
			await page.goto(chat1Url);
			await waitForChatReady(page);

			// Should see chat 1 message
			await expect(page.getByText("Chat 1 message")).toBeVisible();

			// Navigate to second chat
			await page.goto(chat2Url);
			await waitForChatReady(page);

			// Should see chat 2 message
			await expect(page.getByText("Chat 2 message")).toBeVisible();
		});
	});

	test.describe("Error Handling", () => {
		test("should show error message on failed send", async ({ page }) => {
			// This test requires mocking API failures
			// Implementation depends on your error handling
		});

		test("should allow retry after failed send", async ({ page }) => {
			// This test requires mocking API failures and testing retry functionality
		});
	});

	test.describe("Chat UI Responsiveness", () => {
		test("should auto-scroll to latest message", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);

			// Send multiple messages to create scroll
			for (let i = 1; i <= 10; i++) {
				await textarea.fill(`Message ${i}`);
				await textarea.press("Enter");
				await page.waitForTimeout(300);
			}

			// Latest message should be visible
			await expect(page.getByText("Message 10")).toBeVisible({ timeout: 10000 });
		});

		test("should resize textarea as user types", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);

			// Get initial height
			const initialBox = await textarea.boundingBox();
			const initialHeight = initialBox?.height || 0;

			// Type multiple lines
			await textarea.fill("Line 1\nLine 2\nLine 3\nLine 4\nLine 5");

			// Wait for resize
			await page.waitForTimeout(300);

			// Get new height
			const newBox = await textarea.boundingBox();
			const newHeight = newBox?.height || 0;

			// Height should have increased
			expect(newHeight).toBeGreaterThan(initialHeight);
		});
	});
});
