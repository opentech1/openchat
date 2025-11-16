/**
 * Unit Tests for Chat Serializers
 *
 * Tests chat serialization for API responses.
 */

import { describe, it, expect } from "vitest";
import { serializeChat } from "../chat-serializers";
import type { Doc } from "@server/convex/_generated/dataModel";

describe("serializeChat", () => {
	it("should serialize chat with all fields", () => {
		// Arrange
		const chat: Doc<"chats"> = {
			_id: "chat_123" as any,
			_creationTime: 1704067200000,
			title: "Test Chat",
			userId: "user_123",
			updatedAt: 1704067200000,
			lastMessageAt: 1704067260000,
		};

		// Act
		const result = serializeChat(chat);

		// Assert
		expect(result.id).toBe("chat_123");
		expect(result.title).toBe("Test Chat");
		expect(result.updatedAt).toBe("2024-01-01T00:00:00.000Z");
		expect(result.lastMessageAt).toBe("2024-01-01T00:01:00.000Z");
	});

	it("should handle null title", () => {
		// Arrange
		const chat: Doc<"chats"> = {
			_id: "chat_123" as any,
			_creationTime: 1704067200000,
			title: null,
			userId: "user_123",
			updatedAt: 1704067200000,
			lastMessageAt: null,
		};

		// Act
		const result = serializeChat(chat);

		// Assert
		expect(result.title).toBeNull();
	});

	it("should handle null lastMessageAt", () => {
		// Arrange
		const chat: Doc<"chats"> = {
			_id: "chat_123" as any,
			_creationTime: 1704067200000,
			title: "Test",
			userId: "user_123",
			updatedAt: 1704067200000,
			lastMessageAt: null,
		};

		// Act
		const result = serializeChat(chat);

		// Assert
		expect(result.lastMessageAt).toBeNull();
	});

	it("should convert timestamps to ISO strings", () => {
		// Arrange
		const chat: Doc<"chats"> = {
			_id: "chat_123" as any,
			_creationTime: 1704067200000,
			title: "Test",
			userId: "user_123",
			updatedAt: 1704067200000,
			lastMessageAt: 1704067260000,
		};

		// Act
		const result = serializeChat(chat);

		// Assert
		expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		expect(result.lastMessageAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
	});
});
