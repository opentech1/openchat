/**
 * Unit Tests for Chat Export Utilities
 *
 * Tests chat export functionality to various formats:
 * - Markdown (.md)
 * - JSON (.json)
 * - PDF (.pdf)
 *
 * Ensures proper formatting, attachment handling, and large chat support.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import {
	exportToMarkdown,
	exportToJSON,
	exportToPDF,
	type ExportChat,
	type ExportMessage,
} from "@/lib/chat-exporters";

describe("exportToMarkdown", () => {
	const baseChat: ExportChat = {
		title: "Test Chat",
		createdAt: 1700000000000,
		updatedAt: 1700001000000,
	};

	const baseMessage: ExportMessage = {
		role: "user",
		content: "Hello, world!",
		createdAt: 1700000500000,
	};

	test("should export chat with title and metadata", () => {
		const result = exportToMarkdown(baseChat, []);

		expect(result).toContain("# Test Chat");
		expect(result).toContain("**Created:**");
		expect(result).toContain("**Last Updated:**");
		expect(result).toContain("**Messages:** 0");
	});

	test("should format user messages correctly", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, role: "user", content: "User message" },
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("## User");
		expect(result).toContain("User message");
	});

	test("should format assistant messages correctly", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, role: "assistant", content: "Assistant reply" },
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("## Assistant");
		expect(result).toContain("Assistant reply");
	});

	test("should include timestamps for messages", () => {
		const messages: ExportMessage[] = [baseMessage];
		const result = exportToMarkdown(baseChat, messages);

		expect(result).toMatch(/\*.*\*/); // Timestamp in italics
	});

	test("should include reasoning when present", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				reasoning: "This is the reasoning behind the response",
			},
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("**Reasoning:**");
		expect(result).toContain("This is the reasoning behind the response");
	});

	test("should not include reasoning section when absent", () => {
		const messages: ExportMessage[] = [baseMessage];
		const result = exportToMarkdown(baseChat, messages);

		expect(result).not.toContain("**Reasoning:**");
	});

	test("should include attachments with URLs", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				attachments: [
					{ name: "file.txt", type: "text/plain", url: "https://example.com/file.txt" },
				],
			},
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("**Attachments:**");
		expect(result).toContain("- [file.txt](https://example.com/file.txt)");
	});

	test("should include attachments without URLs", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				attachments: [{ name: "local-file.pdf", type: "application/pdf" }],
			},
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("**Attachments:**");
		expect(result).toContain("- local-file.pdf");
	});

	test("should handle multiple attachments", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				attachments: [
					{ name: "file1.txt", type: "text/plain", url: "https://example.com/file1.txt" },
					{ name: "file2.pdf", type: "application/pdf" },
					{ name: "file3.jpg", type: "image/jpeg", url: "https://example.com/file3.jpg" },
				],
			},
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("- [file1.txt](https://example.com/file1.txt)");
		expect(result).toContain("- file2.pdf");
		expect(result).toContain("- [file3.jpg](https://example.com/file3.jpg)");
	});

	test("should not include attachments section when empty", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, attachments: [] },
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).not.toContain("**Attachments:**");
	});

	test("should separate messages with horizontal rules", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, content: "First message" },
			{ ...baseMessage, content: "Second message" },
		];

		const result = exportToMarkdown(baseChat, messages);

		const separatorCount = (result.match(/---/g) || []).length;
		expect(separatorCount).toBeGreaterThanOrEqual(2); // At least 2 separators (header + between messages)
	});

	test("should handle multiple messages in sequence", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, role: "user", content: "Question" },
			{ ...baseMessage, role: "assistant", content: "Answer" },
			{ ...baseMessage, role: "user", content: "Follow-up" },
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("Question");
		expect(result).toContain("Answer");
		expect(result).toContain("Follow-up");
	});

	test("should handle empty message list", () => {
		const result = exportToMarkdown(baseChat, []);

		expect(result).toContain("# Test Chat");
		expect(result).toContain("**Messages:** 0");
	});

	test("should handle special characters in content", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, content: "Special: # * _ ~ ` [link](url)" },
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("Special: # * _ ~ ` [link](url)");
	});

	test("should handle multiline content", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				content: "Line 1\nLine 2\nLine 3",
			},
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("Line 1\nLine 2\nLine 3");
	});

	test("should handle code blocks in content", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				content: "```javascript\nconst x = 1;\n```",
			},
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("```javascript\nconst x = 1;\n```");
	});

	test("should handle very long messages", () => {
		const longContent = "A".repeat(10000);
		const messages: ExportMessage[] = [
			{ ...baseMessage, content: longContent },
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain(longContent);
	});

	test("should handle Unicode characters", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, content: "Hello 世界 🌍 مرحبا" },
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("Hello 世界 🌍 مرحبا");
	});

	test("should handle message with all optional fields", () => {
		const messages: ExportMessage[] = [
			{
				role: "assistant",
				content: "Complete message",
				reasoning: "Detailed reasoning",
				createdAt: 1700000500000,
				attachments: [
					{ name: "doc.pdf", type: "application/pdf", url: "https://example.com/doc.pdf" },
				],
			},
		];

		const result = exportToMarkdown(baseChat, messages);

		expect(result).toContain("Complete message");
		expect(result).toContain("**Reasoning:**");
		expect(result).toContain("Detailed reasoning");
		expect(result).toContain("**Attachments:**");
		expect(result).toContain("[doc.pdf]");
	});
});

describe("exportToJSON", () => {
	const baseChat: ExportChat = {
		title: "Test Chat",
		createdAt: 1700000000000,
		updatedAt: 1700001000000,
	};

	const baseMessage: ExportMessage = {
		role: "user",
		content: "Hello, world!",
		createdAt: 1700000500000,
	};

	test("should return valid JSON string", () => {
		const result = exportToJSON(baseChat, []);

		expect(() => JSON.parse(result)).not.toThrow();
	});

	test("should include chat metadata", () => {
		const result = exportToJSON(baseChat, []);
		const parsed = JSON.parse(result);

		expect(parsed.chat).toBeDefined();
		expect(parsed.chat.title).toBe("Test Chat");
		expect(parsed.chat.createdAt).toBe(1700000000000);
		expect(parsed.chat.updatedAt).toBe(1700001000000);
	});

	test("should include message count", () => {
		const messages: ExportMessage[] = [baseMessage, baseMessage, baseMessage];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.chat.messageCount).toBe(3);
	});

	test("should include messages array", () => {
		const messages: ExportMessage[] = [baseMessage];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages).toBeDefined();
		expect(Array.isArray(parsed.messages)).toBe(true);
		expect(parsed.messages.length).toBe(1);
	});

	test("should include message role", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, role: "assistant" },
		];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages[0].role).toBe("assistant");
	});

	test("should include message content", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, content: "Test content" },
		];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages[0].content).toBe("Test content");
	});

	test("should include message timestamps", () => {
		const messages: ExportMessage[] = [baseMessage];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages[0].createdAt).toBe(1700000500000);
		expect(parsed.messages[0].timestamp).toBeDefined();
		expect(typeof parsed.messages[0].timestamp).toBe("string");
	});

	test("should convert timestamp to ISO format", () => {
		const messages: ExportMessage[] = [baseMessage];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	test("should include reasoning when present", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, reasoning: "Test reasoning" },
		];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages[0].reasoning).toBe("Test reasoning");
	});

	test("should handle undefined reasoning", () => {
		const messages: ExportMessage[] = [baseMessage];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages[0].reasoning).toBeUndefined();
	});

	test("should include attachments", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				attachments: [
					{ name: "file.txt", type: "text/plain", url: "https://example.com/file.txt" },
				],
			},
		];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages[0].attachments).toBeDefined();
		expect(parsed.messages[0].attachments.length).toBe(1);
		expect(parsed.messages[0].attachments[0].name).toBe("file.txt");
	});

	test("should include exportedAt timestamp", () => {
		const result = exportToJSON(baseChat, []);
		const parsed = JSON.parse(result);

		expect(parsed.exportedAt).toBeDefined();
		expect(typeof parsed.exportedAt).toBe("string");
		expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	test("should format JSON with indentation", () => {
		const result = exportToJSON(baseChat, []);

		expect(result).toContain("\n");
		expect(result).toContain("  "); // 2-space indentation
	});

	test("should handle empty messages array", () => {
		const result = exportToJSON(baseChat, []);
		const parsed = JSON.parse(result);

		expect(parsed.messages).toEqual([]);
		expect(parsed.chat.messageCount).toBe(0);
	});

	test("should handle large number of messages", () => {
		const messages: ExportMessage[] = Array(1000)
			.fill(null)
			.map((_, i) => ({
				...baseMessage,
				content: `Message ${i}`,
			}));

		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages.length).toBe(1000);
		expect(parsed.chat.messageCount).toBe(1000);
	});

	test("should preserve Unicode characters", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, content: "测试 🎉 مرحبا" },
		];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages[0].content).toBe("测试 🎉 مرحبا");
	});

	test("should handle special characters in strings", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, content: 'Quote: "test" Backslash: \\ Newline: \n' },
		];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(parsed.messages[0].content).toContain('"test"');
		expect(parsed.messages[0].content).toContain("\\");
		expect(parsed.messages[0].content).toContain("\n");
	});

	test("should maintain data types", () => {
		const messages: ExportMessage[] = [baseMessage];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		expect(typeof parsed.chat.createdAt).toBe("number");
		expect(typeof parsed.chat.updatedAt).toBe("number");
		expect(typeof parsed.messages[0].createdAt).toBe("number");
		expect(typeof parsed.messages[0].timestamp).toBe("string");
	});

	test("should handle all message fields", () => {
		const messages: ExportMessage[] = [
			{
				role: "assistant",
				content: "Full message",
				reasoning: "Test reasoning",
				createdAt: 1700000500000,
				attachments: [
					{ name: "doc.pdf", type: "application/pdf", url: "https://example.com/doc.pdf" },
				],
			},
		];
		const result = exportToJSON(baseChat, messages);
		const parsed = JSON.parse(result);

		const msg = parsed.messages[0];
		expect(msg.role).toBe("assistant");
		expect(msg.content).toBe("Full message");
		expect(msg.reasoning).toBe("Test reasoning");
		expect(msg.createdAt).toBe(1700000500000);
		expect(msg.timestamp).toBeDefined();
		expect(msg.attachments).toBeDefined();
		expect(msg.attachments.length).toBe(1);
	});
});

describe("exportToPDF", () => {
	const baseChat: ExportChat = {
		title: "Test Chat",
		createdAt: 1700000000000,
		updatedAt: 1700001000000,
	};

	const baseMessage: ExportMessage = {
		role: "user",
		content: "Hello, world!",
		createdAt: 1700000500000,
	};

	test("should return a Blob", () => {
		const result = exportToPDF(baseChat, []);

		expect(result).toBeInstanceOf(Blob);
	});

	test("should return PDF blob type", () => {
		const result = exportToPDF(baseChat, []);

		expect(result.type).toBe("application/pdf");
	});

	test("should generate PDF for empty chat", () => {
		const result = exportToPDF(baseChat, []);

		expect(result.size).toBeGreaterThan(0);
	});

	test("should generate PDF with single message", () => {
		const messages: ExportMessage[] = [baseMessage];
		const result = exportToPDF(baseChat, messages);

		expect(result.size).toBeGreaterThan(0);
	});

	test("should generate PDF with multiple messages", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, role: "user", content: "Question" },
			{ ...baseMessage, role: "assistant", content: "Answer" },
			{ ...baseMessage, role: "user", content: "Follow-up" },
		];
		const result = exportToPDF(baseChat, messages);

		expect(result.size).toBeGreaterThan(0);
	});

	test("should handle message with reasoning", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				reasoning: "This is the reasoning",
			},
		];

		expect(() => exportToPDF(baseChat, messages)).not.toThrow();
	});

	test("should handle message with attachments", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				attachments: [
					{ name: "file.txt", type: "text/plain", url: "https://example.com/file.txt" },
				],
			},
		];

		expect(() => exportToPDF(baseChat, messages)).not.toThrow();
	});

	test("should handle very long messages", () => {
		const longContent = "A".repeat(5000);
		const messages: ExportMessage[] = [
			{ ...baseMessage, content: longContent },
		];

		const result = exportToPDF(baseChat, messages);

		expect(result.size).toBeGreaterThan(0);
	});

	test("should handle large number of messages", () => {
		const messages: ExportMessage[] = Array(100)
			.fill(null)
			.map((_, i) => ({
				...baseMessage,
				content: `Message ${i}`,
			}));

		const result = exportToPDF(baseChat, messages);

		expect(result.size).toBeGreaterThan(0);
	});

	test("should handle Unicode characters", () => {
		const messages: ExportMessage[] = [
			{ ...baseMessage, content: "Hello 世界 🌍" },
		];

		expect(() => exportToPDF(baseChat, messages)).not.toThrow();
	});

	test("should handle multiline content", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				content: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5",
			},
		];

		expect(() => exportToPDF(baseChat, messages)).not.toThrow();
	});

	test("should handle all message fields", () => {
		const messages: ExportMessage[] = [
			{
				role: "assistant",
				content: "Full message content",
				reasoning: "Detailed reasoning",
				createdAt: 1700000500000,
				attachments: [
					{ name: "doc.pdf", type: "application/pdf" },
					{ name: "image.png", type: "image/png", url: "https://example.com/image.png" },
				],
			},
		];

		expect(() => exportToPDF(baseChat, messages)).not.toThrow();
	});

	test("should handle special characters in title", () => {
		const chat: ExportChat = {
			...baseChat,
			title: "Special: @#$%^&*()",
		};

		expect(() => exportToPDF(chat, [])).not.toThrow();
	});

	test("should generate larger PDF with more content", () => {
		const emptyResult = exportToPDF(baseChat, []);
		const messages: ExportMessage[] = Array(10)
			.fill(null)
			.map((_, i) => ({
				...baseMessage,
				content: `Message ${i} with some content`,
			}));
		const withContentResult = exportToPDF(baseChat, messages);

		expect(withContentResult.size).toBeGreaterThan(emptyResult.size);
	});

	test("should handle message with only attachments", () => {
		const messages: ExportMessage[] = [
			{
				...baseMessage,
				content: "",
				attachments: [
					{ name: "file1.txt", type: "text/plain" },
					{ name: "file2.pdf", type: "application/pdf" },
				],
			},
		];

		expect(() => exportToPDF(baseChat, messages)).not.toThrow();
	});

	test("should be able to read blob as array buffer", async () => {
		const result = exportToPDF(baseChat, [baseMessage]);
		const buffer = await result.arrayBuffer();

		expect(buffer.byteLength).toBeGreaterThan(0);
	});
});
