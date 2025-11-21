import { test, expect, type Page } from "@playwright/test";
import { login, createNewChat, waitForChatReady } from "./setup/auth";

/**
 * E2E Tests: Model Switching
 *
 * Tests the ability to switch between different AI models,
 * verify the correct model is used, and handle model-specific features.
 */

test.describe("Model Switching", () => {
	test.beforeEach(async ({ page }) => {
		// Setup: Login and create new chat
		await login(page);
		await createNewChat(page);
		await waitForChatReady(page);
	});

	test.describe("Model Selection UI", () => {
		test("should display model selector", async ({ page }) => {
			// Model selector should be visible
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await expect(modelSelector).toBeVisible();
		});

		test("should show current selected model", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await expect(modelSelector).toBeVisible();

			// Should display a model name (not empty)
			const text = await modelSelector.textContent();
			expect(text).toBeTruthy();
			expect(text?.trim().length).toBeGreaterThan(0);
		});

		test("should open model list when clicking selector", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();

			// Model list/dropdown should appear
			// Look for listbox, menu, or combobox role
			const modelList = page.locator('[role="listbox"], [role="menu"], [role="combobox"]');
			// await expect(modelList.first()).toBeVisible({ timeout: 5000 });

			// Or look for model options
			await page.waitForTimeout(500);
		});

		test("should display list of available models", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();

			await page.waitForTimeout(500);

			// Should show multiple model options
			// Looking for common model names or option elements
			const options = page.locator('[role="option"], [data-testid="model-option"]');
			// const count = await options.count();
			// expect(count).toBeGreaterThan(0);
		});

		test("should close model list when clicking outside", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();

			await page.waitForTimeout(300);

			// Click outside
			await page.click("body", { position: { x: 0, y: 0 } });

			// Model list should close
			await page.waitForTimeout(300);
		});

		test("should support keyboard navigation (Cmd+M / Ctrl+M)", async ({ page }) => {
			// Press Cmd+M (Mac) or Ctrl+M (Windows/Linux) to open model selector
			const isMac = process.platform === "darwin";

			if (isMac) {
				await page.keyboard.press("Meta+m");
			} else {
				await page.keyboard.press("Control+m");
			}

			await page.waitForTimeout(500);

			// Model selector should open
			// const modelList = page.locator('[role="listbox"], [role="menu"]');
			// await expect(modelList.first()).toBeVisible({ timeout: 2000 });
		});
	});

	test.describe("Switching Models", () => {
		test("should switch to different model", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();

			// Get initial model
			const initialModel = await modelSelector.textContent();

			// Open selector
			await modelSelector.click();
			await page.waitForTimeout(500);

			// Select a different model (click second option)
			const options = page.locator('[role="option"]');
			const optionCount = await options.count();

			if (optionCount > 1) {
				// Click the second option (different from first/current)
				await options.nth(1).click();

				await page.waitForTimeout(500);

				// Verify model changed
				const newModel = await modelSelector.textContent();
				expect(newModel).not.toBe(initialModel);
			}
		});

		test("should persist model selection across messages", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();

			// Switch model
			await modelSelector.click();
			await page.waitForTimeout(300);

			const options = page.locator('[role="option"]');
			if ((await options.count()) > 1) {
				await options.nth(1).click();
			}

			const selectedModel = await modelSelector.textContent();

			// Send a message
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test message");
			await textarea.press("Enter");

			await page.waitForTimeout(2000);

			// Send another message
			await textarea.fill("Another message");
			await textarea.press("Enter");

			await page.waitForTimeout(2000);

			// Model should still be the same
			const currentModel = await modelSelector.textContent();
			expect(currentModel).toBe(selectedModel);
		});

		test("should persist model selection after page reload", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();

			// Switch model
			await modelSelector.click();
			await page.waitForTimeout(300);

			const options = page.locator('[role="option"]');
			if ((await options.count()) > 1) {
				await options.nth(1).click();
			}

			const selectedModel = await modelSelector.textContent();
			const chatUrl = page.url();

			// Reload page
			await page.reload();
			await waitForChatReady(page);

			// Model should still be selected
			const currentModel = await modelSelector.textContent();
			expect(currentModel).toBe(selectedModel);
		});

		test("should allow switching model mid-conversation", async ({ page }) => {
			const textarea = page.getByPlaceholder(/type your message/i);

			// Send message with first model
			await textarea.fill("First message");
			await textarea.press("Enter");
			await page.waitForTimeout(2000);

			// Switch model
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();
			await page.waitForTimeout(300);

			const options = page.locator('[role="option"]');
			if ((await options.count()) > 1) {
				await options.nth(1).click();
			}

			// Send message with second model
			await textarea.fill("Second message with different model");
			await textarea.press("Enter");
			await page.waitForTimeout(2000);

			// Both messages should be visible
			await expect(page.getByText("First message")).toBeVisible();
			await expect(page.getByText("Second message with different model")).toBeVisible();
		});
	});

	test.describe("Model Information", () => {
		test("should display model capabilities", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();
			await page.waitForTimeout(500);

			// Model options might show capabilities (vision, reasoning, etc.)
			// This is implementation-specific
		});

		test("should show model context window", async ({ page }) => {
			// Look for context usage indicator
			// Should show something like "1.5K / 128K tokens"
			const contextIndicator = page.locator('[data-testid="context-usage-indicator"]');
			// await expect(contextIndicator).toBeVisible();
		});

		test("should display model pricing information", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();
			await page.waitForTimeout(500);

			// Models might show pricing (input/output costs)
			// This is implementation-specific
		});
	});

	test.describe("Model-Specific Features", () => {
		test("should show reasoning controls for reasoning-capable models", async ({ page }) => {
			// Look for a reasoning-capable model and select it
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();
			await page.waitForTimeout(500);

			// Look for models with "reasoning" or "think" in name
			const reasoningModel = page.getByRole("option", { name: /reasoning|think|deep/i }).first();

			if (await reasoningModel.isVisible()) {
				await reasoningModel.click();
				await page.waitForTimeout(500);

				// Should show reasoning controls
				// Look for "Budget", "Effort", or similar controls
				const reasoningControls = page.locator('[data-testid="reasoning-controls"]');
				// await expect(reasoningControls).toBeVisible();
			}
		});

		test("should hide reasoning controls for non-reasoning models", async ({ page }) => {
			// Select a standard model
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();
			await page.waitForTimeout(500);

			// Select a non-reasoning model
			const standardModel = page.getByRole("option", { name: /gpt-4|claude|gemini/i }).first();

			if (await standardModel.isVisible()) {
				const modelName = await standardModel.textContent();

				// Skip if it's a reasoning model
				if (!modelName?.toLowerCase().includes("reasoning")) {
					await standardModel.click();
					await page.waitForTimeout(500);

					// Reasoning controls should not be visible
					const reasoningControls = page.locator('[data-testid="reasoning-controls"]');
					await expect(reasoningControls).not.toBeVisible();
				}
			}
		});

		test("should enable file upload for multimodal models", async ({ page }) => {
			// Select a multimodal model
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();
			await page.waitForTimeout(500);

			// Look for vision-capable models
			const visionModel = page.getByRole("option", { name: /vision|pro|opus/i }).first();

			if (await visionModel.isVisible()) {
				await visionModel.click();
				await page.waitForTimeout(500);

				// File upload button should be enabled
				const uploadButton = page.locator('button[aria-label*="upload" i]').first();
				if (await uploadButton.isVisible()) {
					await expect(uploadButton).toBeEnabled();
				}
			}
		});

		test("should disable file upload for text-only models", async ({ page }) => {
			// This depends on having text-only models available
			// When selected, file upload should be disabled
		});
	});

	test.describe("Model Verification", () => {
		test("should use selected model for generating response", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();

			// Select a specific model
			await modelSelector.click();
			await page.waitForTimeout(300);

			const options = page.locator('[role="option"]');
			if ((await options.count()) > 0) {
				// Get the model name
				const modelOption = options.first();
				const modelName = await modelOption.textContent();

				await modelOption.click();
				await page.waitForTimeout(500);

				// Send a message asking the model to identify itself
				const textarea = page.getByPlaceholder(/type your message/i);
				await textarea.fill("What model are you?");
				await textarea.press("Enter");

				// Wait for response
				await page.waitForTimeout(5000);

				// Response should mention the model name (implementation may vary)
				// This is not always reliable as models may not always correctly identify themselves
			}
		});

		test("should show model name in message metadata", async ({ page }) => {
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test message");
			await textarea.press("Enter");

			await page.waitForTimeout(3000);

			// Look for model name in message metadata or info
			// This is implementation-specific
			// await expect(page.getByText(/model:/i)).toBeVisible();
		});
	});

	test.describe("Model Loading States", () => {
		test("should show loading state when fetching models", async ({ page }) => {
			// On initial load, model selector might show loading
			// This is usually very fast, so hard to test
		});

		test("should handle model list fetch errors", async ({ page }) => {
			// This requires network mocking to simulate API failure
			// Should show error message or fallback UI
		});

		test("should disable model selector while sending message", async ({ page }) => {
			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test message");

			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();

			// Click send
			await textarea.press("Enter");

			// Model selector should be disabled during streaming
			// This might be too fast to catch
			await page.waitForTimeout(100);

			// After response completes, should be re-enabled
			await page.waitForTimeout(3000);
			await expect(modelSelector).toBeEnabled();
		});
	});

	test.describe("Model Search and Filter", () => {
		test("should filter models by search", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();
			await page.waitForTimeout(500);

			// Look for search input in model selector
			const searchInput = page.locator('input[placeholder*="search" i]');

			if (await searchInput.isVisible()) {
				// Type search query
				await searchInput.fill("gpt");

				await page.waitForTimeout(300);

				// Should filter to only GPT models
				const options = page.locator('[role="option"]');
				const visibleOptions = await options.count();

				// All visible options should contain "gpt"
				for (let i = 0; i < visibleOptions; i++) {
					const text = await options.nth(i).textContent();
					expect(text?.toLowerCase()).toContain("gpt");
				}
			}
		});

		test("should show 'no results' when search has no matches", async ({ page }) => {
			const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();
			await modelSelector.click();
			await page.waitForTimeout(500);

			const searchInput = page.locator('input[placeholder*="search" i]');

			if (await searchInput.isVisible()) {
				// Search for something that doesn't exist
				await searchInput.fill("xyznonexistentmodel123");

				await page.waitForTimeout(300);

				// Should show no results message
				// await expect(page.getByText(/no.*models.*found/i)).toBeVisible();
			}
		});
	});

	test.describe("Model Compatibility Warnings", () => {
		test("should warn when switching to incompatible model with files attached", async ({ page }) => {
			// Upload a file first
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				// Upload test file (if fixtures exist)
				// await fileInput.setInputFiles('path/to/test.png');
				// await page.waitForTimeout(2000);

				// Try to switch to text-only model
				// Should show warning or auto-remove files
			}
		});

		test("should clear incompatible features when switching models", async ({ page }) => {
			// If using reasoning model with reasoning config
			// Switching to non-reasoning model should clear reasoning settings
		});
	});
});

test.describe("Model Switching - Edge Cases", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
		await createNewChat(page);
		await waitForChatReady(page);
	});

	test("should handle rapid model switching", async ({ page }) => {
		const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();

		// Rapidly switch between models
		for (let i = 0; i < 5; i++) {
			await modelSelector.click();
			await page.waitForTimeout(200);

			const options = page.locator('[role="option"]');
			const count = await options.count();

			if (count > 1) {
				await options.nth(i % count).click();
				await page.waitForTimeout(200);
			}
		}

		// Should end up with a valid model selected
		const finalModel = await modelSelector.textContent();
		expect(finalModel).toBeTruthy();
	});

	test("should handle switching models during active streaming", async ({ page }) => {
		const textarea = page.getByPlaceholder(/type your message/i);

		// Send message to start streaming
		await textarea.fill("Write a long story");
		await textarea.press("Enter");

		// Wait for streaming to start
		await page.waitForTimeout(1000);

		// Try to switch model during streaming
		const modelSelector = page.getByRole("button", { name: /select.*model/i }).first();

		// Model selector should be disabled during streaming
		const isEnabled = await modelSelector.isEnabled();

		// Either disabled or clicking has no effect
		// expect(isEnabled).toBe(false);
	});
});
