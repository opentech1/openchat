/**
 * Component Tests for FileUploadButton
 *
 * Tests file upload functionality including:
 * - Opening file picker
 * - File type validation
 * - File size validation
 * - Toast error notifications
 * - Model capability checks
 * - Keyboard accessibility
 */

import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileUploadButton } from "./file-upload-button";
import * as sonner from "sonner";

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

describe("FileUploadButton", () => {
	const mockOnFileSelect = vi.fn();
	const mockOnUnsupportedModel = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("File Picker Opening", () => {
		test("should open file picker when clicked", async () => {
			const user = userEvent.setup();

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const button = screen.getByRole("button", { name: /Upload file/i });
			const fileInput = button.parentElement?.querySelector('input[type="file"]');

			expect(fileInput).toBeInTheDocument();

			// Mock click on hidden input
			const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

			await user.click(button);

			expect(clickSpy).toHaveBeenCalled();
		});

		test("should not open file picker when disabled", async () => {
			const user = userEvent.setup();

			render(<FileUploadButton onFileSelect={mockOnFileSelect} disabled />);

			const button = screen.getByRole("button", { name: /Upload file/i });
			expect(button).toBeDisabled();

			const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

			await user.click(button);

			expect(clickSpy).not.toHaveBeenCalled();
		});

		test("should render paperclip icon", () => {
			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const button = screen.getByRole("button", { name: /Upload file/i });
			const icon = button.querySelector('svg');

			expect(icon).toBeInTheDocument();
		});

		test("should show tooltip on hover", async () => {
			const user = userEvent.setup();

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const button = screen.getByRole("button", { name: /Upload file/i });

			// Tooltip appears on hover - verify button has proper aria-label
			expect(button).toHaveAttribute("aria-label", "Upload file");

			// In Radix UI tooltips, the content is rendered but hidden until hover
			// Testing tooltip visibility in happy-dom is unreliable, so we verify the structure
			await user.hover(button);

			// Tooltip should be in the document (Radix renders it but may not be visible in tests)
			await waitFor(() => {
				const tooltips = screen.queryAllByText("Upload file");
				// Should find at least the aria-label (button might show tooltip content too)
				expect(tooltips.length).toBeGreaterThanOrEqual(1);
			}, { timeout: 2000 });
		});
	});

	describe("File Type Validation", () => {
		test("should accept valid image file", async () => {
			const user = userEvent.setup();
			const file = new File(["image content"], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should accept valid PDF file", async () => {
			const user = userEvent.setup();
			const file = new File(["pdf content"], "test.pdf", { type: "application/pdf" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should accept valid audio file when model supports audio", async () => {
			const user = userEvent.setup();
			const file = new File(["audio content"], "test.mp3", { type: "audio/mpeg" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ audio: true }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should accept valid video file when model supports video", async () => {
			const user = userEvent.setup();
			const file = new File(["video content"], "test.mp4", { type: "video/mp4" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ video: true }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should reject unsupported file type", async () => {
			const file = new File(["content"], "test.exe", { type: "application/x-msdownload" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event (bypasses accept attribute)
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalled();
			});
			expect(mockOnFileSelect).not.toHaveBeenCalled();
		});

		test("should reject audio file when model does not support audio", async () => {
			const file = new File(["audio content"], "test.mp3", { type: "audio/mpeg" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ image: true }}
					onUnsupportedModel={mockOnUnsupportedModel}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith(
					expect.anything(),
					expect.objectContaining({ duration: 5000 })
				);
			});
			expect(mockOnFileSelect).not.toHaveBeenCalled();
		});

		test("should reject video file when model does not support video", async () => {
			const file = new File(["video content"], "test.mp4", { type: "video/mp4" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ image: true }}
					onUnsupportedModel={mockOnUnsupportedModel}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalled();
			});
			expect(mockOnFileSelect).not.toHaveBeenCalled();
		});

		test("should accept custom allowed types", async () => {
			const user = userEvent.setup();
			const file = new File(["json content"], "test.json", { type: "application/json" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					allowedTypes={["application/json"]}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should reject file not in custom allowed types", async () => {
			const file = new File(["image content"], "test.png", { type: "image/png" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					allowedTypes={["application/pdf"]}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalled();
			});
			expect(mockOnFileSelect).not.toHaveBeenCalled();
		});
	});

	describe("File Size Validation", () => {
		test("should accept file within default size limit", async () => {
			const user = userEvent.setup();
			// 5MB file (within 10MB default limit)
			const file = new File(["x".repeat(5 * 1024 * 1024)], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should reject file exceeding default size limit", async () => {
			// 15MB file (exceeds 10MB default limit)
			const file = new File(["x".repeat(15 * 1024 * 1024)], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith(
					expect.stringContaining("exceeds")
				);
			});
			expect(mockOnFileSelect).not.toHaveBeenCalled();
		});

		test("should accept file within custom size limit", async () => {
			const user = userEvent.setup();
			// 3MB file (within 5MB custom limit)
			const file = new File(["x".repeat(3 * 1024 * 1024)], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} maxSizeMB={5} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should reject file exceeding custom size limit", async () => {
			// 8MB file (exceeds 5MB custom limit)
			const file = new File(["x".repeat(8 * 1024 * 1024)], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} maxSizeMB={5} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith(
					expect.stringContaining("5MB")
				);
			});
			expect(mockOnFileSelect).not.toHaveBeenCalled();
		});

		test("should use higher limit for audio files", async () => {
			const user = userEvent.setup();
			// 20MB audio file (within 25MB audio limit)
			const file = new File(["x".repeat(20 * 1024 * 1024)], "test.mp3", { type: "audio/mpeg" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ audio: true }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should use higher limit for video files", async () => {
			const user = userEvent.setup();
			// 40MB video file (within 50MB video limit)
			const file = new File(["x".repeat(40 * 1024 * 1024)], "test.mp4", { type: "video/mp4" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ video: true }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should reject audio file exceeding audio limit", async () => {
			const user = userEvent.setup();
			// 30MB audio file (exceeds 25MB audio limit)
			const file = new File(["x".repeat(30 * 1024 * 1024)], "test.mp3", { type: "audio/mpeg" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ audio: true }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).not.toHaveBeenCalled();
			expect(sonner.toast.error).toHaveBeenCalled();
		});
	});

	describe("Toast Notifications", () => {
		test("should show toast error for invalid file type", async () => {
			const file = new File(["content"], "test.exe", { type: "application/x-msdownload" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalled();
			});
		});

		test("should show toast error for file size exceeded", async () => {
			const file = new File(["x".repeat(15 * 1024 * 1024)], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith(
					expect.stringContaining("exceeds")
				);
			});
		});

		test("should show toast with switch model button for unsupported image", async () => {
			const file = new File(["image content"], "test.png", { type: "image/png" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ audio: true }}
					onUnsupportedModel={mockOnUnsupportedModel}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith(
					expect.anything(),
					expect.objectContaining({ duration: 5000 })
				);
			});
		});

		test("should show toast with switch model button for unsupported audio", async () => {
			const file = new File(["audio content"], "test.mp3", { type: "audio/mpeg" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ image: true }}
					onUnsupportedModel={mockOnUnsupportedModel}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith(
					expect.anything(),
					expect.objectContaining({ duration: 5000 })
				);
			});
		});

		test("should show toast with switch model button for unsupported video", async () => {
			const file = new File(["video content"], "test.mp4", { type: "video/mp4" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ image: true }}
					onUnsupportedModel={mockOnUnsupportedModel}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Manually set files and trigger change event
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false,
			});
			input.dispatchEvent(new Event('change', { bubbles: true }));

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith(
					expect.anything(),
					expect.objectContaining({ duration: 5000 })
				);
			});
		});

		test("should show toast when model does not support any files", async () => {
			const user = userEvent.setup();

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{}}
					onUnsupportedModel={mockOnUnsupportedModel}
				/>
			);

			const button = screen.getByRole("button", { name: /Upload file/i });
			await user.click(button);

			expect(sonner.toast.error).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ duration: 5000 })
			);
		});
	});

	describe("Model Capabilities", () => {
		test("should allow images by default when no capabilities specified", () => {
			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			expect(input.accept).toContain("image/");
		});

		test("should allow only images when image capability is true", () => {
			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ image: true }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			expect(input.accept).toContain("image/");
			expect(input.accept).not.toContain("audio/");
		});

		test("should allow audio when audio capability is true", () => {
			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ audio: true }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			expect(input.accept).toContain("audio/");
		});

		test("should allow video when video capability is true", () => {
			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ video: true }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			expect(input.accept).toContain("video/");
		});

		test("should allow all types when all capabilities are true", () => {
			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ image: true, audio: true, video: true }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			expect(input.accept).toContain("image/");
			expect(input.accept).toContain("audio/");
			expect(input.accept).toContain("video/");
		});

		test("should always allow document types", () => {
			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					modelCapabilities={{ image: false }}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			expect(input.accept).toContain("application/pdf");
		});
	});

	describe("Input Reset", () => {
		test("should reset input after successful file selection", async () => {
			const user = userEvent.setup();
			const file = new File(["content"], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(input.value).toBe("");
		});

		test("should reset input after file validation failure", async () => {
			const user = userEvent.setup();
			const file = new File(["x".repeat(15 * 1024 * 1024)], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(input.value).toBe("");
		});

		test("should allow selecting same file again after reset", async () => {
			const user = userEvent.setup();
			const file = new File(["content"], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);
			expect(mockOnFileSelect).toHaveBeenCalledTimes(1);

			// Upload same file again
			await user.upload(input, file);
			expect(mockOnFileSelect).toHaveBeenCalledTimes(2);
		});
	});

	describe("Keyboard Accessibility", () => {
		test("should be keyboard focusable", () => {
			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const button = screen.getByRole("button", { name: /Upload file/i });
			button.focus();

			expect(button).toHaveFocus();
		});

		test("should open file picker on Enter key", async () => {
			const user = userEvent.setup();

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const button = screen.getByRole("button", { name: /Upload file/i });
			button.focus();

			const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

			await user.keyboard("{Enter}");

			expect(clickSpy).toHaveBeenCalled();
		});

		test("should open file picker on Space key", async () => {
			const user = userEvent.setup();

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const button = screen.getByRole("button", { name: /Upload file/i });
			button.focus();

			const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

			await user.keyboard(" ");

			expect(clickSpy).toHaveBeenCalled();
		});

		test("should have proper ARIA label", () => {
			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const button = screen.getByRole("button", { name: /Upload file/i });
			expect(button).toHaveAttribute("aria-label", "Upload file");
		});

		test("should have focus-visible styles", () => {
			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const button = screen.getByRole("button", { name: /Upload file/i });
			expect(button.className).toContain("focus-visible:outline-none");
			expect(button.className).toContain("focus-visible:ring");
		});

		test("should be excluded from tab order when disabled", () => {
			render(<FileUploadButton onFileSelect={mockOnFileSelect} disabled />);

			const button = screen.getByRole("button", { name: /Upload file/i });
			expect(button).toBeDisabled();
			expect(button.className).toContain("disabled:pointer-events-none");
		});
	});

	describe("Edge Cases", () => {
		test("should handle no file selected", async () => {
			const user = userEvent.setup();

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			// Simulate change event with no file
			await user.upload(input, []);

			expect(mockOnFileSelect).not.toHaveBeenCalled();
		});

		test("should handle file with no type", async () => {
			const user = userEvent.setup();
			const file = new File(["content"], "test", { type: "" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).not.toHaveBeenCalled();
		});

		test("should handle very small file", async () => {
			const user = userEvent.setup();
			const file = new File(["x"], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should handle file exactly at size limit", async () => {
			const user = userEvent.setup();
			// Exactly 10MB
			const file = new File(["x".repeat(10 * 1024 * 1024)], "test.png", { type: "image/png" });

			render(<FileUploadButton onFileSelect={mockOnFileSelect} />);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, file);

			expect(mockOnFileSelect).toHaveBeenCalledWith(file);
		});

		test("should handle multiple file types supported", async () => {
			const user = userEvent.setup();
			const imageFile = new File(["image"], "test.png", { type: "image/png" });
			const pdfFile = new File(["pdf"], "test.pdf", { type: "application/pdf" });

			render(
				<FileUploadButton
					onFileSelect={mockOnFileSelect}
					allowedTypes={["image/png", "application/pdf"]}
				/>
			);

			const input = screen.getByRole("button", { name: /Upload file/i })
				.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

			await user.upload(input, imageFile);
			expect(mockOnFileSelect).toHaveBeenCalledWith(imageFile);

			await user.upload(input, pdfFile);
			expect(mockOnFileSelect).toHaveBeenCalledWith(pdfFile);
		});
	});
});
