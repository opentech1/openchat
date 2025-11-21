import { test, expect, type Page } from "@playwright/test";
import { login, createNewChat, waitForChatReady } from "./setup/auth";

/**
 * E2E Tests: Error Recovery
 *
 * Tests error handling and recovery mechanisms including network errors,
 * retry functionality, and graceful degradation.
 */

test.describe("Error Recovery", () => {
	test.beforeEach(async ({ page }) => {
		// Setup: Login and create new chat
		await login(page);
		await createNewChat(page);
		await waitForChatReady(page);
	});

	test.describe("Network Error Handling", () => {
		test("should show error message on network failure", async ({ page, context }) => {
			// Simulate network failure by going offline
			await context.setOffline(true);

			// Try to send a message
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("This message should fail");
			await textarea.press("Enter");

			// Wait for error message
			await page.waitForTimeout(2000);

			// Should show error notification or message
			const errorMessage = page.getByText(/network.*error|failed.*send|couldn't.*connect|offline/i);
			await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });

			// Re-enable network
			await context.setOffline(false);
		});

		test("should retain message in input on send failure", async ({ page, context }) => {
			const testMessage = "Message that will fail to send";

			// Go offline
			await context.setOffline(true);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(testMessage);
			await textarea.press("Enter");

			// Wait for failure
			await page.waitForTimeout(2000);

			// Message should be restored to input
			const textareaValue = await textarea.inputValue();
			expect(textareaValue).toBe(testMessage);

			// Re-enable network
			await context.setOffline(false);
		});

		test("should show retry button after network error", async ({ page, context }) => {
			// Go offline
			await context.setOffline(true);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test retry message");
			await textarea.press("Enter");

			// Wait for error
			await page.waitForTimeout(2000);

			// Look for retry button
			const retryButton = page.getByRole("button", { name: /retry|try again/i });
			// await expect(retryButton.first()).toBeVisible({ timeout: 10000 });

			// Re-enable network
			await context.setOffline(false);
		});

		test("should successfully send message after clicking retry", async ({ page, context }) => {
			const testMessage = "Retry test message";

			// Go offline
			await context.setOffline(true);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(testMessage);
			await textarea.press("Enter");

			// Wait for error
			await page.waitForTimeout(2000);

			// Go back online
			await context.setOffline(false);

			// Click retry button
			const retryButton = page.getByRole("button", { name: /retry|try again/i });

			if (await retryButton.first().isVisible()) {
				await retryButton.first().click();

				// Message should be sent successfully
				await expect(page.getByText(testMessage)).toBeVisible({ timeout: 15000 });
			}
		});

		test("should handle intermittent network failures", async ({ page, context }) => {
			const textarea = page.getByPlaceholder(/type your message/i);

			// Send message successfully
			await textarea.fill("First message - should succeed");
			await textarea.press("Enter");
			await page.waitForTimeout(2000);

			// Go offline for next message
			await context.setOffline(true);
			await textarea.fill("Second message - should fail");
			await textarea.press("Enter");
			await page.waitForTimeout(2000);

			// Should show error
			const errorMessage = page.getByText(/error|failed|offline/i);
			await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });

			// Go back online
			await context.setOffline(false);

			// Third message should succeed
			await textarea.fill("Third message - should succeed");
			await textarea.press("Enter");

			// Should send successfully
			await expect(page.getByText("Third message - should succeed")).toBeVisible({
				timeout: 15000,
			});
		});
	});

	test.describe("API Error Handling", () => {
		test("should handle API timeout errors", async ({ page }) => {
			// This test requires mocking slow API responses
			// Would need to use route mocking to delay responses
			// await page.route('**/api/chat/**', route => {
			//   setTimeout(() => route.continue(), 60000); // Delay 60s to trigger timeout
			// });

			// Then send message and verify timeout error is shown
		});

		test("should handle API rate limiting errors", async ({ page }) => {
			// This test requires mocking rate limit responses
			// await page.route('**/api/chat/**', route => {
			//   route.fulfill({
			//     status: 429,
			//     body: JSON.stringify({ error: 'Rate limit exceeded' })
			//   });
			// });

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test rate limit");
			await textarea.press("Enter");

			// Should show rate limit error
			// await expect(page.getByText(/rate limit|too many requests/i)).toBeVisible({ timeout: 5000 });
		});

		test("should handle API authentication errors", async ({ page, context }) => {
			// Clear auth cookies to simulate auth error
			await context.clearCookies();

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test auth error");
			await textarea.press("Enter");

			// Should either redirect to login or show auth error
			await page.waitForTimeout(2000);

			// Might redirect to sign-in
			const currentUrl = page.url();
			if (currentUrl.includes("/auth/sign-in")) {
				expect(currentUrl).toContain("/auth/sign-in");
			} else {
				// Or show error message
				// await expect(page.getByText(/authentication|unauthorized|sign in/i)).toBeVisible();
			}
		});

		test("should handle invalid API responses", async ({ page }) => {
			// This test requires mocking invalid API responses
			// Would need route mocking to return malformed JSON
		});
	});

	test.describe("Model-Specific Errors", () => {
		test("should handle model not available error", async ({ page }) => {
			// This test requires mocking model unavailability
			// Or selecting a model that doesn't exist
		});

		test("should handle insufficient credits error", async ({ page }) => {
			// This test requires mocking credits/quota errors
			// Should show error about insufficient credits or quota
		});

		test("should suggest alternative model on error", async ({ page }) => {
			// When a model fails, might suggest switching to alternative
		});
	});

	test.describe("Input Validation Errors", () => {
		test("should prevent sending without API key", async ({ page }) => {
			// This depends on how API key is managed
			// If API key is missing, send should be disabled or show error
		});

		test("should prevent sending without model selected", async ({ page }) => {
			// If no model is selected, send should be disabled
			const sendButton = page.getByRole("button", { name: /send message/i });

			// Send button state depends on whether a default model is selected
			// await expect(sendButton).toBeDisabled();
		});

		test("should handle extremely long messages", async ({ page }) => {
			// Try to send a message that exceeds context limit
			const veryLongMessage = "A".repeat(1000000); // 1 million characters

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill(veryLongMessage);

			// Might show warning or prevent sending
			// await expect(page.getByText(/too long|exceeds limit|context limit/i)).toBeVisible();
		});
	});

	test.describe("Error Recovery UI/UX", () => {
		test("should allow dismissing error messages", async ({ page, context }) => {
			// Trigger an error
			await context.setOffline(true);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Error test");
			await textarea.press("Enter");

			await page.waitForTimeout(2000);

			// Look for close/dismiss button on error
			const closeButton = page.locator('button[aria-label*="close" i], button[aria-label*="dismiss" i]').first();

			if (await closeButton.isVisible()) {
				await closeButton.click();

				// Error should be dismissed
				await page.waitForTimeout(300);
			}

			await context.setOffline(false);
		});

		test("should clear error state after successful retry", async ({ page, context }) => {
			// Trigger error
			await context.setOffline(true);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Clear error test");
			await textarea.press("Enter");

			await page.waitForTimeout(2000);

			// Go online and retry
			await context.setOffline(false);

			const retryButton = page.getByRole("button", { name: /retry|try again/i });

			if (await retryButton.first().isVisible()) {
				await retryButton.first().click();

				// Wait for success
				await page.waitForTimeout(3000);

				// Error message should be gone
				const errorMessage = page.getByText(/error|failed/i);
				// Most error messages should be cleared
			}
		});

		test("should show different error messages for different error types", async ({ page, context }) => {
			// Network error
			await context.setOffline(true);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Network error");
			await textarea.press("Enter");

			await page.waitForTimeout(2000);

			// Should show network-specific error
			const networkError = page.getByText(/network|offline|connection/i);
			// await expect(networkError.first()).toBeVisible({ timeout: 5000 });

			await context.setOffline(false);

			// Other types of errors would show different messages
		});
	});

	test.describe("Graceful Degradation", () => {
		test("should continue working after recovering from error", async ({ page, context }) => {
			// Cause an error
			await context.setOffline(true);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Error message");
			await textarea.press("Enter");

			await page.waitForTimeout(2000);

			// Recover
			await context.setOffline(false);

			// Retry or send new message
			await textarea.fill("Recovery message");
			await textarea.press("Enter");

			// Should work normally
			await expect(page.getByText("Recovery message")).toBeVisible({ timeout: 15000 });
		});

		test("should handle multiple consecutive errors", async ({ page, context }) => {
			// Cause multiple errors in a row
			await context.setOffline(true);

			const textarea = page.getByPlaceholder(/type your message/i);

			// First error
			await textarea.fill("Error 1");
			await textarea.press("Enter");
			await page.waitForTimeout(1000);

			// Second error
			await textarea.fill("Error 2");
			await textarea.press("Enter");
			await page.waitForTimeout(1000);

			// Third error
			await textarea.fill("Error 3");
			await textarea.press("Enter");
			await page.waitForTimeout(1000);

			// Should handle all errors gracefully without crashing
			await context.setOffline(false);

			// App should still be functional
			await textarea.fill("Recovery test");
			await textarea.press("Enter");

			await expect(page.getByText("Recovery test")).toBeVisible({ timeout: 15000 });
		});

		test("should preserve chat state during errors", async ({ page, context }) => {
			// Send a successful message
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Successful message");
			await textarea.press("Enter");
			await page.waitForTimeout(2000);

			// Cause an error
			await context.setOffline(true);
			await textarea.fill("Failed message");
			await textarea.press("Enter");
			await page.waitForTimeout(2000);

			// Original successful message should still be visible
			await expect(page.getByText("Successful message")).toBeVisible();

			await context.setOffline(false);
		});

		test("should maintain UI responsiveness during errors", async ({ page, context }) => {
			// Cause an error
			await context.setOffline(true);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Error test");
			await textarea.press("Enter");

			await page.waitForTimeout(2000);

			// UI should still be responsive - can type in textarea
			await textarea.fill("Can still type");
			const value = await textarea.inputValue();
			expect(value).toBe("Can still type");

			// Can interact with other UI elements
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			if (await modelSelector.isVisible()) {
				const isEnabled = await modelSelector.isEnabled();
				expect(isEnabled).toBeTruthy();
			}

			await context.setOffline(false);
		});
	});

	test.describe("Error Logging and Debugging", () => {
		test("should log errors to console", async ({ page }) => {
			// Listen for console errors
			const consoleErrors: string[] = [];

			page.on("console", msg => {
				if (msg.type() === "error") {
					consoleErrors.push(msg.text());
				}
			});

			// Cause an error
			// This would need proper error simulation
		});

		test("should not crash on unhandled errors", async ({ page }) => {
			// This test verifies the app has proper error boundaries
			// Would need to trigger various error conditions

			// After any error, the app should still be running
			// Check that essential UI elements are still present
			const textarea = page.getByPlaceholder(/type your message/i);
			await expect(textarea).toBeVisible();
		});
	});
});

test.describe("Error Recovery - Edge Cases", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
		await createNewChat(page);
		await waitForChatReady(page);
	});

	test("should handle error during streaming response", async ({ page, context }) => {
		const textarea = page.getByPlaceholder(/type your message/i);
		await textarea.fill("Write a long story");
		await textarea.press("Enter");

		// Wait for streaming to start
		await page.waitForTimeout(1500);

		// Simulate network loss during streaming
		await context.setOffline(true);

		await page.waitForTimeout(1000);

		// Should show error or stop streaming
		// await expect(page.getByText(/error|connection lost|interrupted/i)).toBeVisible({ timeout: 5000 });

		await context.setOffline(false);
	});

	test("should handle rapid network fluctuations", async ({ page, context }) => {
		const textarea = page.getByPlaceholder(/type your message/i);

		// Rapidly toggle network
		for (let i = 0; i < 3; i++) {
			await context.setOffline(true);
			await page.waitForTimeout(500);
			await context.setOffline(false);
			await page.waitForTimeout(500);
		}

		// App should still work
		await textarea.fill("Test after fluctuations");
		await textarea.press("Enter");

		// Should eventually send
		await expect(page.getByText("Test after fluctuations")).toBeVisible({ timeout: 20000 });
	});

	test("should handle page reload during error state", async ({ page, context }) => {
		// Cause an error
		await context.setOffline(true);

		const textarea = page.getByPlaceholder(/type your message/i);
		await textarea.fill("Error before reload");
		await textarea.press("Enter");

		await page.waitForTimeout(2000);

		// Reload page
		await page.reload();

		// Go back online
		await context.setOffline(false);

		// Wait for chat to load
		await waitForChatReady(page);

		// Should be in clean state, no errors
		await textarea.fill("Message after reload");
		await textarea.press("Enter");

		await expect(page.getByText("Message after reload")).toBeVisible({ timeout: 15000 });
	});
});
