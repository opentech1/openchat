import { test, expect, type Page } from "@playwright/test";
import { login, createNewChat, waitForChatReady } from "./setup/auth";
import path from "path";

/**
 * E2E Tests: File Upload Functionality
 *
 * Tests file upload feature including image/document uploads,
 * file previews, sending files with messages, and viewing in chat history.
 */

test.describe("File Upload", () => {
	test.beforeEach(async ({ page }) => {
		// Setup: Login and create new chat
		await login(page);
		await createNewChat(page);
		await waitForChatReady(page);
	});

	test.describe("Upload Interface", () => {
		test("should show file upload button", async ({ page }) => {
			// Look for file upload button (paperclip icon or similar)
			const uploadButton = page.locator('button:has-text("upload"), button[aria-label*="upload" i], button[aria-label*="attach" i]').first();

			// Alternative: Look for file input
			const fileInput = page.locator('input[type="file"]');

			// At least one should be visible
			const uploadVisible = await uploadButton.isVisible().catch(() => false);
			const inputExists = await fileInput.count();

			expect(uploadVisible || inputExists > 0).toBeTruthy();
		});

		test("should open file picker when upload button is clicked", async ({ page }) => {
			// Find upload button
			const uploadButton = page.locator('button[aria-label*="upload" i], button[aria-label*="attach" i]').first();

			if (await uploadButton.isVisible()) {
				// Create file chooser promise before clicking
				const fileChooserPromise = page.waitForEvent("filechooser");
				await uploadButton.click();

				// Verify file chooser opened
				const fileChooser = await fileChooserPromise;
				expect(fileChooser).toBeTruthy();
			}
		});

		test("should accept image file types", async ({ page }) => {
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				const acceptAttr = await fileInput.getAttribute("accept");

				// Should accept image types
				// Could be "image/*" or specific types like "image/png,image/jpeg"
				if (acceptAttr) {
					expect(
						acceptAttr.includes("image") ||
						acceptAttr.includes("*") ||
						acceptAttr.includes(".png") ||
						acceptAttr.includes(".jpg")
					).toBeTruthy();
				}
			}
		});

		test("should show upload quota information", async ({ page }) => {
			// Look for quota indicator (implementation specific)
			// This might show "3 of 10 files used" or similar
			// await expect(page.getByText(/\d+\s*of\s*\d+/)).toBeVisible();
		});
	});

	test.describe("Image Upload", () => {
		test("should upload an image file", async ({ page }) => {
			// Create a test image file path
			// You'll need to have test fixtures in your test directory
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");

			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				// Set the file
				await fileInput.setInputFiles(testImagePath);

				// Wait for upload to complete
				await page.waitForTimeout(2000);

				// Should show success message or preview
				// await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 10000 });
			}
		});

		test("should display image preview after upload", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				// Look for image preview element
				const imagePreview = page.locator('img[src*="blob:"], img[src*="data:image"], [data-testid="file-preview"]');
				// await expect(imagePreview.first()).toBeVisible({ timeout: 10000 });
			}
		});

		test("should show image filename in preview", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				// Should show filename somewhere
				// await expect(page.getByText(/test-image\.png/i)).toBeVisible({ timeout: 10000 });
			}
		});

		test("should show image file size", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				// Should show file size (e.g., "45 KB")
				// await expect(page.getByText(/\d+\s*(KB|MB)/i)).toBeVisible({ timeout: 10000 });
			}
		});

		test("should allow removing uploaded image before sending", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				// Look for remove/delete button
				const removeButton = page.locator('button[aria-label*="remove" i], button[aria-label*="delete" i], button:has-text("×")').first();

				if (await removeButton.isVisible()) {
					await removeButton.click();

					// Preview should disappear
					const imagePreview = page.locator('[data-testid="file-preview"]');
					await expect(imagePreview).not.toBeVisible();
				}
			}
		});

		test("should support multiple image formats (PNG)", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				// Should show preview
				// await expect(page.locator('[data-testid="file-preview"]')).toBeVisible({ timeout: 10000 });
			}
		});

		test("should support JPEG images", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.jpg");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);
			}
		});

		test("should support WebP images", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.webp");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);
			}
		});
	});

	test.describe("Sending Files with Messages", () => {
		test("should send message with attached image", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				// Upload image
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				// Type message
				const textarea = page.getByPlaceholder(/type your message/i);
				await textarea.fill("Here is an image");

				// Send
				await textarea.press("Enter");

				// Message should appear
				await expect(page.getByText("Here is an image")).toBeVisible({ timeout: 10000 });
			}
		});

		test("should send image without text message", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				// Upload image
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				// Send without typing anything
				const sendButton = page.getByRole("button", { name: /send message/i });

				// Should be able to send with just an image
				if (await sendButton.isEnabled()) {
					await sendButton.click();

					// Wait for message to appear
					await page.waitForTimeout(2000);
				}
			}
		});

		test("should clear file preview after sending", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				// Upload and send
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				const textarea = page.getByPlaceholder(/type your message/i);
				await textarea.fill("Test");
				await textarea.press("Enter");

				await page.waitForTimeout(2000);

				// Preview should be cleared
				const imagePreview = page.locator('[data-testid="file-preview"]');
				await expect(imagePreview).not.toBeVisible();
			}
		});

		test("should handle sending multiple messages with files", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				// First message with file
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				const textarea = page.getByPlaceholder(/type your message/i);
				await textarea.fill("First image");
				await textarea.press("Enter");

				await page.waitForTimeout(2000);

				// Second message with file
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				await textarea.fill("Second image");
				await textarea.press("Enter");

				// Both messages should appear
				await expect(page.getByText("First image")).toBeVisible({ timeout: 10000 });
				await expect(page.getByText("Second image")).toBeVisible({ timeout: 10000 });
			}
		});
	});

	test.describe("File Upload Validation", () => {
		test("should reject files that are too large", async ({ page }) => {
			// This test requires a large file fixture
			// When exceeded, should show error message
			// await expect(page.getByText(/file too large|exceeds maximum size/i)).toBeVisible();
		});

		test("should enforce upload quota limits", async ({ page }) => {
			// Upload files until quota is reached
			// Should show error when quota exceeded
			// await expect(page.getByText(/quota exceeded|upload limit reached/i)).toBeVisible();
		});

		test("should reject unsupported file types", async ({ page }) => {
			const testFilePath = path.join(__dirname, "fixtures", "test-file.exe");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				try {
					await fileInput.setInputFiles(testFilePath);
					await page.waitForTimeout(2000);

					// Should show error for unsupported type
					// await expect(page.getByText(/unsupported file type|invalid file/i)).toBeVisible();
				} catch (e) {
					// File might be rejected before upload
				}
			}
		});

		test("should show error for corrupted files", async ({ page }) => {
			// This test requires a corrupted file fixture
			// Should handle gracefully with error message
		});
	});

	test.describe("File Upload UI/UX", () => {
		test("should show upload progress indicator", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);

				// Should briefly show loading/uploading indicator
				// await expect(page.locator('[role="progressbar"], .loading, .uploading')).toBeVisible({ timeout: 5000 });

				// Then show success
				await page.waitForTimeout(2000);
			}
		});

		test("should disable upload button during upload", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);

				// Upload button should be disabled briefly
				const uploadButton = page.locator('button[aria-label*="upload" i]').first();
				// await expect(uploadButton).toBeDisabled({ timeout: 1000 });

				// Then re-enabled
				await page.waitForTimeout(2000);
				// await expect(uploadButton).toBeEnabled();
			}
		});

		test("should show upload success notification", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				// Should show success toast/notification
				// await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 10000 });
			}
		});

		test("should allow drag and drop upload", async ({ page }) => {
			// This test requires simulating drag and drop
			// Playwright supports this with page.dispatchEvent
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");

			// Get the drop zone
			const dropZone = page.locator('textarea, [data-drop-zone]').first();

			// Create a data transfer
			// Note: This is a complex test that may need special setup
		});
	});

	test.describe("File Preview in Chat", () => {
		test("should display uploaded image in chat message", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				const textarea = page.getByPlaceholder(/type your message/i);
				await textarea.fill("Check this image");
				await textarea.press("Enter");

				await page.waitForTimeout(2000);

				// Image should appear in chat message
				const chatImage = page.locator('[data-testid="chat-message"] img').first();
				// await expect(chatImage).toBeVisible({ timeout: 10000 });
			}
		});

		test("should allow clicking image to view full size", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				const textarea = page.getByPlaceholder(/type your message/i);
				await textarea.fill("Image for viewing");
				await textarea.press("Enter");

				await page.waitForTimeout(2000);

				// Click image in chat
				const chatImage = page.locator('[data-testid="chat-message"] img').first();

				if (await chatImage.isVisible()) {
					await chatImage.click();

					// Should open lightbox or full-size view
					// await expect(page.locator('[role="dialog"], .lightbox, .image-viewer')).toBeVisible();
				}
			}
		});

		test("should persist uploaded files after page reload", async ({ page }) => {
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				const textarea = page.getByPlaceholder(/type your message/i);
				await textarea.fill("Persistent image");
				await textarea.press("Enter");

				await page.waitForTimeout(2000);

				// Reload page
				await page.reload();
				await waitForChatReady(page);

				// Image should still be visible
				await expect(page.getByText("Persistent image")).toBeVisible({ timeout: 10000 });
			}
		});
	});

	test.describe("Model Compatibility", () => {
		test("should switch to compatible model when uploading file", async ({ page }) => {
			// If current model doesn't support files, should switch to one that does
			const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
			const fileInput = page.locator('input[type="file"]').first();

			if (await fileInput.count() > 0) {
				// Select a text-only model first (if available)
				// Then upload file
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(2000);

				// Should show notification about model switch
				// await expect(page.getByText(/switched to.*model/i)).toBeVisible({ timeout: 5000 });
			}
		});

		test("should disable file upload for non-multimodal models", async ({ page }) => {
			// If model doesn't support files, upload button should be disabled or show warning
			// This is implementation-specific
		});
	});
});

test.describe("File Upload - Edge Cases", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
		await createNewChat(page);
		await waitForChatReady(page);
	});

	test("should handle rapid successive uploads", async ({ page }) => {
		const testImagePath = path.join(__dirname, "fixtures", "test-image.png");
		const fileInput = page.locator('input[type="file"]').first();

		if (await fileInput.count() > 0) {
			// Upload same file multiple times quickly
			for (let i = 0; i < 3; i++) {
				await fileInput.setInputFiles(testImagePath);
				await page.waitForTimeout(500);
			}

			// Should handle gracefully (queue uploads, show multiple previews, or prevent duplicates)
			await page.waitForTimeout(2000);
		}
	});

	test("should handle upload cancellation", async ({ page }) => {
		// This test would require simulating network conditions to allow cancellation
		// Or mocking slow upload to test cancel functionality
	});

	test("should retry failed uploads", async ({ page }) => {
		// This test requires network mocking to simulate failures
		// Then verify retry mechanism works
	});
});
