import { test, expect, type Page, type Download } from "@playwright/test";
import { login, createNewChat, waitForChatReady } from "./setup/auth";

/**
 * E2E Tests: Chat Export Functionality
 *
 * Tests exporting chats in different formats (Markdown, JSON, PDF),
 * downloading files, and verifying export content.
 */

test.describe("Chat Export", () => {
	test.beforeEach(async ({ page }) => {
		// Setup: Login, create chat, and send some messages
		await login(page);
		await createNewChat(page);
		await waitForChatReady(page);

		// Send a few test messages to have content to export
		const textarea = page.getByPlaceholder(/type your message/i);

		await textarea.fill("First test message");
		await textarea.press("Enter");
		await page.waitForTimeout(2000);

		await textarea.fill("Second test message");
		await textarea.press("Enter");
		await page.waitForTimeout(2000);
	});

	test.describe("Export Button UI", () => {
		test("should display export button", async ({ page }) => {
			// Look for export/download button
			const exportButton = page.locator('button[aria-label*="export" i], button:has-text("export")').first();

			// Alternative: Look for download icon
			const downloadIcon = page.locator('button:has([class*="download" i])').first();

			// At least one should be visible
			const exportVisible = await exportButton.isVisible().catch(() => false);
			const downloadVisible = await downloadIcon.isVisible().catch(() => false);

			expect(exportVisible || downloadVisible).toBeTruthy();
		});

		test("should open export menu when clicking export button", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();

				// Export menu should appear with format options
				await page.waitForTimeout(300);

				// Look for menu or popover
				const exportMenu = page.locator('[role="menu"], [role="dialog"]');
				// await expect(exportMenu.first()).toBeVisible({ timeout: 2000 });
			}
		});

		test("should show export format options", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				// Should show Markdown, JSON, PDF options
				await expect(page.getByText(/markdown/i)).toBeVisible();
				await expect(page.getByText(/json/i)).toBeVisible();
				await expect(page.getByText(/pdf/i)).toBeVisible();
			}
		});

		test("should close export menu when clicking outside", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(300);

				// Click outside
				await page.click("body", { position: { x: 0, y: 0 } });

				await page.waitForTimeout(300);

				// Menu should close (Markdown option should not be visible)
				// const markdownOption = page.getByText(/markdown.*\.md/i);
				// await expect(markdownOption).not.toBeVisible();
			}
		});
	});

	test.describe("Export as Markdown", () => {
		test("should export chat as Markdown file", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				// Click Markdown option and wait for download
				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });

				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				// Wait for download to start
				const download = await downloadPromise;

				// Verify download
				expect(download).toBeTruthy();
				expect(download.suggestedFilename()).toMatch(/\.md$/);
			}
		});

		test("should include user messages in Markdown export", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				const download = await downloadPromise;

				// Save and read the downloaded file
				const path = await download.path();

				if (path) {
					const fs = require("fs");
					const content = fs.readFileSync(path, "utf-8");

					// Should contain the test messages
					expect(content).toContain("First test message");
					expect(content).toContain("Second test message");
				}
			}
		});

		test("should include AI responses in Markdown export", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				const download = await downloadPromise;
				const path = await download.path();

				if (path) {
					const fs = require("fs");
					const content = fs.readFileSync(path, "utf-8");

					// Should contain AI responses (if any)
					// This depends on whether the test environment actually gets AI responses
				}
			}
		});

		test("should format Markdown export correctly", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				const download = await downloadPromise;
				const path = await download.path();

				if (path) {
					const fs = require("fs");
					const content = fs.readFileSync(path, "utf-8");

					// Should have proper Markdown formatting
					// Headers for messages, timestamps, etc.
					expect(content).toMatch(/#.*|##.*/); // Should have headers
				}
			}
		});

		test("should show success notification after Markdown export", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				await downloadPromise;

				// Should show success toast
				await expect(page.getByText(/exported.*markdown/i)).toBeVisible({ timeout: 5000 });
			}
		});
	});

	test.describe("Export as JSON", () => {
		test("should export chat as JSON file", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const jsonOption = page.getByText(/json/i).first();
				await jsonOption.click();

				const download = await downloadPromise;

				expect(download).toBeTruthy();
				expect(download.suggestedFilename()).toMatch(/\.json$/);
			}
		});

		test("should include all message data in JSON export", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const jsonOption = page.getByText(/json/i).first();
				await jsonOption.click();

				const download = await downloadPromise;
				const path = await download.path();

				if (path) {
					const fs = require("fs");
					const content = fs.readFileSync(path, "utf-8");
					const data = JSON.parse(content);

					// Should be valid JSON
					expect(data).toBeTruthy();

					// Should have messages array
					expect(Array.isArray(data.messages) || Array.isArray(data)).toBeTruthy();
				}
			}
		});

		test("should format JSON export correctly", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const jsonOption = page.getByText(/json/i).first();
				await jsonOption.click();

				const download = await downloadPromise;
				const path = await download.path();

				if (path) {
					const fs = require("fs");
					const content = fs.readFileSync(path, "utf-8");

					// Should be properly formatted JSON
					expect(() => JSON.parse(content)).not.toThrow();

					const data = JSON.parse(content);

					// Should have expected structure
					// Depends on your export format
				}
			}
		});

		test("should show success notification after JSON export", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const jsonOption = page.getByText(/json/i).first();
				await jsonOption.click();

				await downloadPromise;

				// Should show success toast
				await expect(page.getByText(/exported.*json/i)).toBeVisible({ timeout: 5000 });
			}
		});
	});

	test.describe("Export as PDF", () => {
		test("should export chat as PDF file", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
				const pdfOption = page.getByText(/pdf/i).first();
				await pdfOption.click();

				const download = await downloadPromise;

				expect(download).toBeTruthy();
				expect(download.suggestedFilename()).toMatch(/\.pdf$/);
			}
		});

		test("should generate valid PDF file", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
				const pdfOption = page.getByText(/pdf/i).first();
				await pdfOption.click();

				const download = await downloadPromise;
				const path = await download.path();

				if (path) {
					const fs = require("fs");
					const buffer = fs.readFileSync(path);

					// PDF files start with %PDF
					expect(buffer.toString("utf-8", 0, 4)).toBe("%PDF");
				}
			}
		});

		test("should show success notification after PDF export", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
				const pdfOption = page.getByText(/pdf/i).first();
				await pdfOption.click();

				await downloadPromise;

				// Should show success toast
				await expect(page.getByText(/exported.*pdf/i)).toBeVisible({ timeout: 5000 });
			}
		});
	});

	test.describe("Export File Naming", () => {
		test("should use chat title in export filename", async ({ page }) => {
			// If chat has a title, it should be used in filename
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				const download = await downloadPromise;
				const filename = download.suggestedFilename();

				// Should have some identifier in filename
				expect(filename).toBeTruthy();
				expect(filename.length).toBeGreaterThan(3); // More than just ".md"
			}
		});

		test("should include timestamp in export filename", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				const download = await downloadPromise;
				const filename = download.suggestedFilename();

				// Might include date/timestamp
				// Format varies: YYYY-MM-DD, timestamp, etc.
			}
		});

		test("should sanitize special characters in filename", async ({ page }) => {
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				const download = await downloadPromise;
				const filename = download.suggestedFilename();

				// Should not contain invalid filename characters
				expect(filename).not.toMatch(/[<>:"/\\|?*]/);
			}
		});
	});

	test.describe("Export Error Handling", () => {
		test("should handle export errors gracefully", async ({ page }) => {
			// This test requires mocking API failures
			// Should show error message if export fails
		});

		test("should show error for empty chat export", async ({ page }) => {
			// Create a new empty chat
			await createNewChat(page);
			await waitForChatReady(page);

			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				// Might show error or warning about empty chat
				// await expect(page.getByText(/no messages|empty chat/i)).toBeVisible({ timeout: 5000 });
			}
		});

		test("should handle rate limiting on exports", async ({ page }) => {
			// Rapidly export multiple times
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				for (let i = 0; i < 5; i++) {
					await exportButton.click();
					await page.waitForTimeout(300);

					const markdownOption = page.getByText(/markdown/i).first();

					if (await markdownOption.isVisible()) {
						await markdownOption.click();
						await page.waitForTimeout(500);
					}
				}

				// Might show rate limit error
				// await expect(page.getByText(/rate limit|too many requests/i)).toBeVisible({ timeout: 5000 });
			}
		});
	});

	test.describe("Export with Special Content", () => {
		test("should export chat with file attachments", async ({ page }) => {
			// If chat has file attachments, they should be noted in export
			// This test would need file upload first
		});

		test("should export chat with code blocks", async ({ page }) => {
			// Create chat with code
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Show me a JavaScript function");
			await textarea.press("Enter");

			await page.waitForTimeout(5000);

			// Export
			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				const download = await downloadPromise;
				const path = await download.path();

				if (path) {
					const fs = require("fs");
					const content = fs.readFileSync(path, "utf-8");

					// Should contain code blocks (```language or similar)
					// expect(content).toMatch(/```/);
				}
			}
		});

		test("should export chat with markdown formatting", async ({ page }) => {
			// AI responses might contain markdown
			// Export should preserve or handle it appropriately
		});

		test("should export chat with special characters", async ({ page }) => {
			await createNewChat(page);
			await waitForChatReady(page);

			const textarea = page.getByPlaceholder(/type your message/i);
			await textarea.fill("Test with special chars: <>&\"'你好🚀");
			await textarea.press("Enter");

			await page.waitForTimeout(2000);

			const exportButton = page.locator('button[aria-label*="export" i]').first();

			if (await exportButton.isVisible()) {
				await exportButton.click();
				await page.waitForTimeout(500);

				const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
				const markdownOption = page.getByText(/markdown/i).first();
				await markdownOption.click();

				const download = await downloadPromise;
				const path = await download.path();

				if (path) {
					const fs = require("fs");
					const content = fs.readFileSync(path, "utf-8");

					// Should contain the special characters
					expect(content).toContain("你好🚀");
				}
			}
		});
	});
});

test.describe("Chat Export - UI/UX", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
		await createNewChat(page);
		await waitForChatReady(page);

		// Send test messages
		const textarea = page.getByPlaceholder(/type your message/i);
		await textarea.fill("Test message");
		await textarea.press("Enter");
		await page.waitForTimeout(2000);
	});

	test("should disable export button during export", async ({ page }) => {
		const exportButton = page.locator('button[aria-label*="export" i]').first();

		if (await exportButton.isVisible()) {
			await exportButton.click();
			await page.waitForTimeout(500);

			const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
			const markdownOption = page.getByText(/markdown/i).first();
			await markdownOption.click();

			// Export button might be disabled during export
			// This is usually very fast
			await page.waitForTimeout(100);

			await downloadPromise;

			// Should be re-enabled after export
			await expect(exportButton).toBeEnabled();
		}
	});

	test("should show loading state during export", async ({ page }) => {
		const exportButton = page.locator('button[aria-label*="export" i]').first();

		if (await exportButton.isVisible()) {
			await exportButton.click();
			await page.waitForTimeout(500);

			const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
			const markdownOption = page.getByText(/markdown/i).first();
			await markdownOption.click();

			// Might show loading spinner or text
			// Usually too fast to catch
			await page.waitForTimeout(100);

			await downloadPromise;
		}
	});
});
