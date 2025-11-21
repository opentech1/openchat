/**
 * Component Tests for ChatExportButton
 *
 * Tests chat export functionality including:
 * - Export as Markdown
 * - Export as JSON
 * - Export as PDF
 * - Download dialog interaction
 * - Export error handling
 * - Loading states
 */

import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatExportButton } from "./chat-export-button";
import * as sonner from "sonner";
import * as csrfClient from "@/lib/csrf-client";

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

// Mock CSRF client
vi.mock("@/lib/csrf-client", () => ({
	getCsrfToken: vi.fn().mockResolvedValue("mock-csrf-token"),
	CSRF_HEADER_NAME: "X-CSRF-Token",
}));

describe("ChatExportButton", () => {
	const mockChatId = "test-chat-123";

	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
		global.URL.createObjectURL = vi.fn(() => "mock-blob-url");
		global.URL.revokeObjectURL = vi.fn();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("Rendering", () => {
		test("should render export button", () => {
			render(<ChatExportButton chatId={mockChatId} />);

			expect(screen.getByRole("button", { name: /Export chat/i })).toBeInTheDocument();
		});

		test("should render download icon", () => {
			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			const icon = button.querySelector("svg");

			expect(icon).toBeInTheDocument();
		});

		test("should apply custom className", () => {
			render(<ChatExportButton chatId={mockChatId} className="custom-class" />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			expect(button.className).toContain("custom-class");
		});

		test("should have proper ARIA label", () => {
			render(<ChatExportButton chatId={mockChatId} />);

			expect(screen.getByRole("button", { name: /Export chat/i })).toHaveAttribute(
				"aria-label",
				"Export chat"
			);
		});
	});

	describe("Export Menu", () => {
		test("should open export menu when clicked", async () => {
			const user = userEvent.setup();

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByText(/Markdown/i)).toBeInTheDocument();
			});
		});

		test("should show all export format options", async () => {
			const user = userEvent.setup();

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByText(/Markdown \(\.md\)/i)).toBeInTheDocument();
				expect(screen.getByText(/JSON \(\.json\)/i)).toBeInTheDocument();
				expect(screen.getByText(/PDF \(\.pdf\)/i)).toBeInTheDocument();
			});
		});

		test("should close menu when clicking outside", async () => {
			const user = userEvent.setup();

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByText(/Markdown/i)).toBeInTheDocument();
			});

			// Click outside
			await user.click(document.body);

			await waitFor(() => {
				expect(screen.queryByText(/Markdown/i)).not.toBeInTheDocument();
			});
		});

		test("should display format icons", async () => {
			const user = userEvent.setup();

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			await waitFor(() => {
				const menu = screen.getByText(/Markdown/i).parentElement?.parentElement;
				const icons = menu?.querySelectorAll("svg");
				expect(icons?.length).toBeGreaterThanOrEqual(3);
			});
		});
	});

	describe("Export as Markdown", () => {
		test("should export chat as Markdown", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["# Chat Export"], { type: "text/markdown" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="chat-export.md"',
				}),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByText(/Markdown/i)).toBeInTheDocument();
			});

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(fetch).toHaveBeenCalledWith(
					`/api/chats/${mockChatId}/export?format=markdown`,
					expect.objectContaining({
						method: "GET",
						headers: {
							"X-CSRF-Token": "mock-csrf-token",
						},
					})
				);
			});

			await waitFor(() => {
				expect(sonner.toast.success).toHaveBeenCalledWith("Chat exported as MARKDOWN");
			});
		});

		test("should use correct filename for Markdown export", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["# Chat Export"], { type: "text/markdown" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="my-chat.md"',
				}),
			});

			// Track anchor creation
			let capturedAnchor: HTMLAnchorElement | null = null;
			const originalCreateElement = document.createElement.bind(document);
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					const element = originalCreateElement(tagName);
					if (tagName === "a") {
						capturedAnchor = element as HTMLAnchorElement;
					}
					return element;
				});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(capturedAnchor).not.toBeNull();
				expect(capturedAnchor?.download).toBe("my-chat.md");
			}, { timeout: 3000 });

			createElementSpy.mockRestore();
		});

		test("should close menu after Markdown export", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["# Chat Export"], { type: "text/markdown" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="chat-export.md"',
				}),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(screen.queryByText(/Markdown/i)).not.toBeInTheDocument();
			});
		});
	});

	describe("Export as JSON", () => {
		test("should export chat as JSON", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(['{"messages": []}'], { type: "application/json" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="chat-export.json"',
				}),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByText(/JSON/i)).toBeInTheDocument();
			});

			const jsonButton = screen.getByText(/JSON/i).closest("button");
			await user.click(jsonButton!);

			await waitFor(() => {
				expect(fetch).toHaveBeenCalledWith(
					`/api/chats/${mockChatId}/export?format=json`,
					expect.objectContaining({
						method: "GET",
						headers: {
							"X-CSRF-Token": "mock-csrf-token",
						},
					})
				);
			});

			await waitFor(() => {
				expect(sonner.toast.success).toHaveBeenCalledWith("Chat exported as JSON");
			});
		});

		test("should use correct filename for JSON export", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(['{"messages": []}'], { type: "application/json" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="my-chat.json"',
				}),
			});

			// Track anchor creation
			let capturedAnchor: HTMLAnchorElement | null = null;
			const originalCreateElement = document.createElement.bind(document);
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					const element = originalCreateElement(tagName);
					if (tagName === "a") {
						capturedAnchor = element as HTMLAnchorElement;
					}
					return element;
				});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const jsonButton = screen.getByText(/JSON/i).closest("button");
			await user.click(jsonButton!);

			await waitFor(() => {
				expect(capturedAnchor).not.toBeNull();
				expect(capturedAnchor?.download).toBe("my-chat.json");
			}, { timeout: 3000 });

			createElementSpy.mockRestore();
		});
	});

	describe("Export as PDF", () => {
		test("should export chat as PDF", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["PDF content"], { type: "application/pdf" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="chat-export.pdf"',
				}),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByText(/PDF/i)).toBeInTheDocument();
			});

			const pdfButton = screen.getByText(/PDF/i).closest("button");
			await user.click(pdfButton!);

			await waitFor(() => {
				expect(fetch).toHaveBeenCalledWith(
					`/api/chats/${mockChatId}/export?format=pdf`,
					expect.objectContaining({
						method: "GET",
						headers: {
							"X-CSRF-Token": "mock-csrf-token",
						},
					})
				);
			});

			await waitFor(() => {
				expect(sonner.toast.success).toHaveBeenCalledWith("Chat exported as PDF");
			});
		});

		test("should use correct filename for PDF export", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["PDF content"], { type: "application/pdf" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="my-chat.pdf"',
				}),
			});

			// Track anchor creation
			let capturedAnchor: HTMLAnchorElement | null = null;
			const originalCreateElement = document.createElement.bind(document);
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					const element = originalCreateElement(tagName);
					if (tagName === "a") {
						capturedAnchor = element as HTMLAnchorElement;
					}
					return element;
				});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const pdfButton = screen.getByText(/PDF/i).closest("button");
			await user.click(pdfButton!);

			await waitFor(() => {
				expect(capturedAnchor).not.toBeNull();
				expect(capturedAnchor?.download).toBe("my-chat.pdf");
			}, { timeout: 3000 });

			createElementSpy.mockRestore();
		});
	});

	describe("Download Dialog", () => {
		test("should create download link and trigger download", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["content"], { type: "text/markdown" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="chat-export.md"',
				}),
			});

			// Track anchor creation
			let capturedAnchor: HTMLAnchorElement | null = null;
			const originalCreateElement = document.createElement.bind(document);
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					const element = originalCreateElement(tagName);
					if (tagName === "a") {
						capturedAnchor = element as HTMLAnchorElement;
					}
					return element;
				});

			const appendChildSpy = vi.spyOn(document.body, "appendChild");
			const removeChildSpy = vi.spyOn(document.body, "removeChild");

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(capturedAnchor).not.toBeNull();
				expect(appendChildSpy).toHaveBeenCalled();
				expect(removeChildSpy).toHaveBeenCalled();
			}, { timeout: 3000 });

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});

		test("should create blob URL for download", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["content"], { type: "text/markdown" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="chat-export.md"',
				}),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
			});
		});

		test("should revoke blob URL after download", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["content"], { type: "text/markdown" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="chat-export.md"',
				}),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(URL.revokeObjectURL).toHaveBeenCalledWith("mock-blob-url");
			});
		});

		test("should use default filename when Content-Disposition header is missing", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["content"], { type: "text/markdown" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers(),
			});

			// Track anchor creation
			let capturedAnchor: HTMLAnchorElement | null = null;
			const originalCreateElement = document.createElement.bind(document);
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					const element = originalCreateElement(tagName);
					if (tagName === "a") {
						capturedAnchor = element as HTMLAnchorElement;
					}
					return element;
				});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(capturedAnchor).not.toBeNull();
				expect(capturedAnchor?.download).toBe("chat-export.md");
			}, { timeout: 3000 });

			createElementSpy.mockRestore();
		});
	});

	describe("Export Error Handling", () => {
		test("should show error toast when export fails", async () => {
			const user = userEvent.setup();

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: false,
				json: () => Promise.resolve({ error: "Export failed" }),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith("Export failed");
			});
		});

		test("should show generic error when no error message provided", async () => {
			const user = userEvent.setup();

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: false,
				json: () => Promise.resolve({}),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith("Export failed");
			});
		});

		test("should handle network errors", async () => {
			const user = userEvent.setup();

			(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error("Network error")
			);

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith("Network error");
			});
		});

		test("should handle unknown errors", async () => {
			const user = userEvent.setup();

			(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce("Unknown error");

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith("Failed to export chat");
			});
		});

		test("should log errors to console", async () => {
			const user = userEvent.setup();
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error("Test error")
			);

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"Export error:",
					expect.any(Error)
				);
			});

			consoleErrorSpy.mockRestore();
		});
	});

	describe("Loading States", () => {
		test("should disable button during export", async () => {
			const user = userEvent.setup();

			(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									ok: true,
									blob: () => Promise.resolve(new Blob(["content"])),
									headers: new Headers({
										"Content-Disposition": 'attachment; filename="chat.md"',
									}),
								}),
							100
						)
					)
			);

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			// Button should be disabled during export
			await waitFor(() => {
				expect(button).toBeDisabled();
			});
		});

		test("should show loading state on button", async () => {
			const user = userEvent.setup();

			(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									ok: true,
									blob: () => Promise.resolve(new Blob(["content"])),
									headers: new Headers({
										"Content-Disposition": 'attachment; filename="chat.md"',
									}),
								}),
							100
						)
					)
			);

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			// Button should have loading styles
			await waitFor(() => {
				expect(button.className).toContain("opacity-50");
			});
		});

		test("should re-enable button after export completes", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["content"], { type: "text/markdown" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="chat-export.md"',
				}),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(button).not.toBeDisabled();
			});
		});

		test("should re-enable button after export fails", async () => {
			const user = userEvent.setup();

			(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error("Export failed")
			);

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(button).not.toBeDisabled();
			});
		});

		test("should disable menu options during export", async () => {
			const user = userEvent.setup();

			(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									ok: true,
									blob: () => Promise.resolve(new Blob(["content"])),
									headers: new Headers({
										"Content-Disposition": 'attachment; filename="chat.md"',
									}),
								}),
							100
						)
					)
			);

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			// All menu options should be disabled
			await waitFor(() => {
				const buttons = screen.getAllByRole("button");
				buttons.forEach((btn) => {
					if (btn.textContent?.includes("Markdown") || btn.textContent?.includes("JSON") || btn.textContent?.includes("PDF")) {
						expect(btn).toBeDisabled();
					}
				});
			});
		});
	});

	describe("CSRF Token", () => {
		test("should include CSRF token in export request", async () => {
			const user = userEvent.setup();
			const mockBlob = new Blob(["content"], { type: "text/markdown" });

			(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
				headers: new Headers({
					"Content-Disposition": 'attachment; filename="chat-export.md"',
				}),
			});

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(csrfClient.getCsrfToken).toHaveBeenCalled();
				expect(fetch).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						headers: {
							"X-CSRF-Token": "mock-csrf-token",
						},
					})
				);
			});
		});

		test("should handle CSRF token fetch failure", async () => {
			const user = userEvent.setup();

			vi.mocked(csrfClient.getCsrfToken).mockRejectedValueOnce(
				new Error("CSRF token fetch failed")
			);

			render(<ChatExportButton chatId={mockChatId} />);

			const button = screen.getByRole("button", { name: /Export chat/i });
			await user.click(button);

			const markdownButton = screen.getByText(/Markdown/i).closest("button");
			await user.click(markdownButton!);

			await waitFor(() => {
				expect(sonner.toast.error).toHaveBeenCalledWith("CSRF token fetch failed");
			});
		});
	});
});
