/**
 * Unit Tests for Chat Message Utils
 *
 * Tests message normalization, date parsing, and message merging logic.
 */

import { describe, it, expect } from "vitest";
import {
	normalizeMessage,
	normalizeUiMessage,
	toUiMessage,
	toElectricMessageRecord,
	mergeNormalizedMessages,
	type MessageLike,
	type NormalizedMessage,
} from "../chat-message-utils";
import type { UIMessage } from "ai";

describe("normalizeMessage", () => {
	it("should normalize message with all fields", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "assistant",
			content: "Hello!",
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:01:00Z",
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.id).toBe("msg_123");
		expect(result.role).toBe("assistant");
		expect(result.content).toBe("Hello!");
		expect(result.createdAt).toBeInstanceOf(Date);
		expect(result.updatedAt).toBeInstanceOf(Date);
	});

	it("should default role to user", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "unknown",
			content: "Hello!",
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.role).toBe("user");
	});

	it("should parse ISO 8601 date strings", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			created_at: "2024-01-15T10:30:00Z",
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.createdAt.toISOString()).toBe("2024-01-15T10:30:00.000Z");
	});

	it("should parse timestamp numbers", () => {
		// Arrange
		const timestamp = new Date("2024-01-01T00:00:00Z").getTime();
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			created_at: timestamp,
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.createdAt.getTime()).toBe(timestamp);
	});

	it("should handle Date objects", () => {
		// Arrange
		const date = new Date("2024-01-01T00:00:00Z");
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			created_at: date,
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.createdAt.getTime()).toBe(date.getTime());
	});

	it("should fallback to current time for invalid dates", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			created_at: "invalid-date",
		};

		const before = Date.now();
		// Act
		const result = normalizeMessage(message);
		const after = Date.now();

		// Assert
		expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(result.createdAt.getTime()).toBeLessThanOrEqual(after);
	});

	it("should handle null dates gracefully", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			created_at: null,
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.createdAt).toBeInstanceOf(Date);
	});

	it("should prefer created_at over createdAt", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			created_at: "2024-01-01T00:00:00Z",
			createdAt: "2024-01-02T00:00:00Z",
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.createdAt.toISOString()).toBe("2024-01-01T00:00:00.000Z");
	});

	it("should fallback to createdAt when created_at missing", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			createdAt: "2024-01-02T00:00:00Z",
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.createdAt.toISOString()).toBe("2024-01-02T00:00:00.000Z");
	});

	it("should set updatedAt to null when missing", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			created_at: "2024-01-01T00:00:00Z",
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.updatedAt).toBeNull();
	});

	it("should parse updatedAt when provided", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:01:00Z",
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.updatedAt).toBeInstanceOf(Date);
		expect(result.updatedAt!.toISOString()).toBe("2024-01-01T00:01:00.000Z");
	});

	it("should handle assistant role", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "assistant",
			content: "Hello!",
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.role).toBe("assistant");
	});

	it("should handle empty content", () => {
		// Arrange
		const message: MessageLike = {
			id: "msg_123",
			role: "user",
			content: "",
		};

		// Act
		const result = normalizeMessage(message);

		// Assert
		expect(result.content).toBe("");
	});
});

describe("normalizeUiMessage", () => {
	it("should normalize UIMessage with text parts", () => {
		// Arrange
		const message: UIMessage<{ createdAt?: string }> = {
			id: "msg_123",
			role: "user",
			parts: [{ type: "text", text: "Hello!" }],
			metadata: { createdAt: "2024-01-01T00:00:00Z" },
		};

		// Act
		const result = normalizeUiMessage(message);

		// Assert
		expect(result.id).toBe("msg_123");
		expect(result.role).toBe("user");
		expect(result.content).toBe("Hello!");
		expect(result.createdAt.toISOString()).toBe("2024-01-01T00:00:00.000Z");
	});

	it("should concatenate multiple text parts", () => {
		// Arrange
		const message: UIMessage<{ createdAt?: string }> = {
			id: "msg_123",
			role: "assistant",
			parts: [
				{ type: "text", text: "Hello " },
				{ type: "text", text: "World!" },
			],
			metadata: {},
		};

		// Act
		const result = normalizeUiMessage(message);

		// Assert
		expect(result.content).toBe("Hello World!");
	});

	it("should filter out non-text parts", () => {
		// Arrange
		const message: UIMessage<{ createdAt?: string }> = {
			id: "msg_123",
			role: "user",
			parts: [
				{ type: "text", text: "Hello" },
				{ type: "image" as any, url: "https://example.com/image.jpg" },
				{ type: "text", text: " World!" },
			],
			metadata: {},
		};

		// Act
		const result = normalizeUiMessage(message);

		// Assert
		expect(result.content).toBe("Hello World!");
	});

	it("should handle missing metadata", () => {
		// Arrange
		const message: UIMessage<{ createdAt?: string }> = {
			id: "msg_123",
			role: "user",
			parts: [{ type: "text", text: "Hello!" }],
		};

		// Act
		const result = normalizeUiMessage(message);

		// Assert
		expect(result.createdAt).toBeInstanceOf(Date);
	});
});

describe("toUiMessage", () => {
	it("should convert normalized message to UIMessage", () => {
		// Arrange
		const message: NormalizedMessage = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			createdAt: new Date("2024-01-01T00:00:00Z"),
			updatedAt: null,
		};

		// Act
		const result = toUiMessage(message);

		// Assert
		expect(result.id).toBe("msg_123");
		expect(result.role).toBe("user");
		expect(result.parts).toEqual([{ type: "text", text: "Hello!" }]);
		expect(result.metadata?.createdAt).toBe("2024-01-01T00:00:00.000Z");
	});

	it("should handle assistant messages", () => {
		// Arrange
		const message: NormalizedMessage = {
			id: "msg_123",
			role: "assistant",
			content: "Hello!",
			createdAt: new Date("2024-01-01T00:00:00Z"),
			updatedAt: null,
		};

		// Act
		const result = toUiMessage(message);

		// Assert
		expect(result.role).toBe("assistant");
	});

	it("should preserve long content", () => {
		// Arrange
		const longContent = "A".repeat(10000);
		const message: NormalizedMessage = {
			id: "msg_123",
			role: "user",
			content: longContent,
			createdAt: new Date(),
			updatedAt: null,
		};

		// Act
		const result = toUiMessage(message);

		// Assert
		expect(result.parts[0]!.text).toBe(longContent);
	});
});

describe("toElectricMessageRecord", () => {
	it("should convert to Electric record format", () => {
		// Arrange
		const message: NormalizedMessage = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			createdAt: new Date("2024-01-01T00:00:00Z"),
			updatedAt: new Date("2024-01-01T00:01:00Z"),
		};

		// Act
		const result = toElectricMessageRecord(message);

		// Assert
		expect(result.id).toBe("msg_123");
		expect(result.role).toBe("user");
		expect(result.content).toBe("Hello!");
		expect(result.created_at).toBe("2024-01-01T00:00:00.000Z");
		expect(result.updated_at).toBe("2024-01-01T00:01:00.000Z");
	});

	it("should use createdAt as updated_at when updatedAt is null", () => {
		// Arrange
		const message: NormalizedMessage = {
			id: "msg_123",
			role: "user",
			content: "Hello!",
			createdAt: new Date("2024-01-01T00:00:00Z"),
			updatedAt: null,
		};

		// Act
		const result = toElectricMessageRecord(message);

		// Assert
		expect(result.updated_at).toBe("2024-01-01T00:00:00.000Z");
	});
});

describe("mergeNormalizedMessages", () => {
	it("should merge unique messages", () => {
		// Arrange
		const base: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "First",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: null,
			},
		];
		const overlay: NormalizedMessage[] = [
			{
				id: "msg_2",
				role: "user",
				content: "Second",
				createdAt: new Date("2024-01-01T00:01:00Z"),
				updatedAt: null,
			},
		];

		// Act
		const result = mergeNormalizedMessages(base, overlay);

		// Assert
		expect(result).toHaveLength(2);
		expect(result[0]!.id).toBe("msg_1");
		expect(result[1]!.id).toBe("msg_2");
	});

	it("should prefer newer createdAt for same ID", () => {
		// Arrange
		const base: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "Old",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: null,
			},
		];
		const overlay: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "New",
				createdAt: new Date("2024-01-01T00:01:00Z"),
				updatedAt: null,
			},
		];

		// Act
		const result = mergeNormalizedMessages(base, overlay);

		// Assert
		expect(result).toHaveLength(1);
		expect(result[0]!.content).toBe("New");
	});

	it("should prefer longer content when preferNewerContent is true", () => {
		// Arrange
		const base: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "Short",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: null,
			},
		];
		const overlay: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "Much longer content",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: null,
			},
		];

		// Act
		const result = mergeNormalizedMessages(base, overlay, {
			preferNewerContent: true,
		});

		// Assert
		expect(result[0]!.content).toBe("Much longer content");
	});

	it("should not prefer longer content when preferNewerContent is false", () => {
		// Arrange
		const base: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "Short",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: null,
			},
		];
		const overlay: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "Much longer content",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: null,
			},
		];

		// Act
		const result = mergeNormalizedMessages(base, overlay, {
			preferNewerContent: false,
		});

		// Assert
		expect(result[0]!.content).toBe("Short");
	});

	it("should prefer newer updatedAt", () => {
		// Arrange
		const base: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "Old",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: new Date("2024-01-01T00:01:00Z"),
			},
		];
		const overlay: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "New",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: new Date("2024-01-01T00:02:00Z"),
			},
		];

		// Act
		const result = mergeNormalizedMessages(base, overlay);

		// Assert
		expect(result[0]!.content).toBe("New");
	});

	it("should sort by createdAt", () => {
		// Arrange
		const base: NormalizedMessage[] = [
			{
				id: "msg_2",
				role: "user",
				content: "Second",
				createdAt: new Date("2024-01-01T00:01:00Z"),
				updatedAt: null,
			},
		];
		const overlay: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "First",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: null,
			},
		];

		// Act
		const result = mergeNormalizedMessages(base, overlay);

		// Assert
		expect(result[0]!.id).toBe("msg_1");
		expect(result[1]!.id).toBe("msg_2");
	});

	it("should sort by ID when createdAt is same", () => {
		// Arrange
		const date = new Date("2024-01-01T00:00:00Z");
		const base: NormalizedMessage[] = [
			{
				id: "msg_b",
				role: "user",
				content: "B",
				createdAt: date,
				updatedAt: null,
			},
		];
		const overlay: NormalizedMessage[] = [
			{
				id: "msg_a",
				role: "user",
				content: "A",
				createdAt: date,
				updatedAt: null,
			},
		];

		// Act
		const result = mergeNormalizedMessages(base, overlay);

		// Assert
		expect(result[0]!.id).toBe("msg_a");
		expect(result[1]!.id).toBe("msg_b");
	});

	it("should handle empty arrays", () => {
		// Act
		const result = mergeNormalizedMessages([], []);

		// Assert
		expect(result).toEqual([]);
	});

	it("should handle empty overlay", () => {
		// Arrange
		const base: NormalizedMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "First",
				createdAt: new Date("2024-01-01T00:00:00Z"),
				updatedAt: null,
			},
		];

		// Act
		const result = mergeNormalizedMessages(base, []);

		// Assert
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe("msg_1");
	});
});
