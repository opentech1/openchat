/**
 * Unit Tests for Chat Serializers
 *
 * Tests serialization logic for chat objects:
 * - Serialize chat objects
 * - Handle missing fields gracefully
 * - Type conversions
 * - Data format validation
 */

import { describe, test, expect } from "vitest";
import {
	serializeChat,
	type ListChat,
	type SerializedChat,
} from "@/lib/chat-serializers";

describe("serializeChat", () => {
	const baseChat: ListChat = {
		_id: "chat_123" as any,
		title: "Test Chat",
		createdAt: 1700000000000,
		updatedAt: 1700001000000,
		lastMessageAt: 1700000500000,
	};

	test("should serialize a complete chat object", () => {
		const result = serializeChat(baseChat);

		expect(result).toBeDefined();
		expect(result.id).toBe("chat_123");
		expect(result.title).toBe("Test Chat");
	});

	test("should convert _id to id", () => {
		const result = serializeChat(baseChat);

		expect(result.id).toBe(baseChat._id);
		expect(result).not.toHaveProperty("_id");
	});

	test("should preserve title", () => {
		const result = serializeChat(baseChat);

		expect(result.title).toBe("Test Chat");
	});

	test("should convert updatedAt timestamp to ISO string", () => {
		const result = serializeChat(baseChat);

		expect(typeof result.updatedAt).toBe("string");
		expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	test("should convert lastMessageAt timestamp to ISO string", () => {
		const result = serializeChat(baseChat);

		expect(result.lastMessageAt).not.toBeNull();
		expect(typeof result.lastMessageAt).toBe("string");
		expect(result.lastMessageAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	test("should handle missing lastMessageAt", () => {
		const chat: ListChat = {
			...baseChat,
			lastMessageAt: undefined,
		};

		const result = serializeChat(chat);

		expect(result.lastMessageAt).toBeNull();
	});

	test("should convert updatedAt to valid ISO 8601 format", () => {
		const result = serializeChat(baseChat);
		const date = new Date(result.updatedAt);

		expect(date.getTime()).toBe(baseChat.updatedAt);
	});

	test("should convert lastMessageAt to valid ISO 8601 format", () => {
		const result = serializeChat(baseChat);
		const date = new Date(result.lastMessageAt!);

		expect(date.getTime()).toBe(baseChat.lastMessageAt);
	});

	test("should handle zero timestamp", () => {
		const chat: ListChat = {
			...baseChat,
			updatedAt: 0,
			lastMessageAt: 0,
		};

		const result = serializeChat(chat);

		expect(result.updatedAt).toBe(new Date(0).toISOString());
		// Note: lastMessageAt of 0 is falsy, so it's treated as null
		expect(result.lastMessageAt).toBeNull();
	});

	test("should handle very large timestamps", () => {
		const futureTime = 9999999999999;
		const chat: ListChat = {
			...baseChat,
			updatedAt: futureTime,
			lastMessageAt: futureTime,
		};

		const result = serializeChat(chat);

		expect(result.updatedAt).toBe(new Date(futureTime).toISOString());
		expect(result.lastMessageAt).toBe(new Date(futureTime).toISOString());
	});

	test("should handle chat with special characters in title", () => {
		const chat: ListChat = {
			...baseChat,
			title: "Special: @#$%^&*() <script>alert('xss')</script>",
		};

		const result = serializeChat(chat);

		expect(result.title).toBe(chat.title);
	});

	test("should handle chat with Unicode title", () => {
		const chat: ListChat = {
			...baseChat,
			title: "测试聊天 🎉 مرحبا",
		};

		const result = serializeChat(chat);

		expect(result.title).toBe("测试聊天 🎉 مرحبا");
	});

	test("should handle empty title", () => {
		const chat: ListChat = {
			...baseChat,
			title: "",
		};

		const result = serializeChat(chat);

		expect(result.title).toBe("");
	});

	test("should handle very long title", () => {
		const longTitle = "A".repeat(1000);
		const chat: ListChat = {
			...baseChat,
			title: longTitle,
		};

		const result = serializeChat(chat);

		expect(result.title).toBe(longTitle);
	});

	test("should return object with correct properties", () => {
		const result = serializeChat(baseChat);
		const keys = Object.keys(result);

		expect(keys).toContain("id");
		expect(keys).toContain("title");
		expect(keys).toContain("updatedAt");
		expect(keys).toContain("lastMessageAt");
		expect(keys.length).toBe(4);
	});

	test("should not include createdAt in serialized output", () => {
		const result = serializeChat(baseChat);

		expect(result).not.toHaveProperty("createdAt");
	});

	test("should maintain timestamp precision", () => {
		const preciseTime = 1700000000123;
		const chat: ListChat = {
			...baseChat,
			updatedAt: preciseTime,
			lastMessageAt: preciseTime,
		};

		const result = serializeChat(chat);
		const updatedDate = new Date(result.updatedAt);
		const lastMessageDate = new Date(result.lastMessageAt!);

		expect(updatedDate.getTime()).toBe(preciseTime);
		expect(lastMessageDate.getTime()).toBe(preciseTime);
	});

	test("should handle multiple serializations consistently", () => {
		const result1 = serializeChat(baseChat);
		const result2 = serializeChat(baseChat);

		expect(result1).toEqual(result2);
	});

	test("should create independent objects", () => {
		const result1 = serializeChat(baseChat);
		const result2 = serializeChat(baseChat);

		expect(result1).not.toBe(result2);
	});

	test("should handle different timestamp formats correctly", () => {
		const chat1: ListChat = {
			...baseChat,
			updatedAt: 1700000000000,
		};
		const chat2: ListChat = {
			...baseChat,
			updatedAt: 1700000000999,
		};

		const result1 = serializeChat(chat1);
		const result2 = serializeChat(chat2);

		expect(result1.updatedAt).not.toBe(result2.updatedAt);
	});

	test("should serialize multiple chats independently", () => {
		const chat1: ListChat = {
			_id: "chat_1" as any,
			title: "Chat 1",
			createdAt: 1700000000000,
			updatedAt: 1700001000000,
		};

		const chat2: ListChat = {
			_id: "chat_2" as any,
			title: "Chat 2",
			createdAt: 1700002000000,
			updatedAt: 1700003000000,
		};

		const result1 = serializeChat(chat1);
		const result2 = serializeChat(chat2);

		expect(result1.id).toBe("chat_1");
		expect(result2.id).toBe("chat_2");
		expect(result1.title).toBe("Chat 1");
		expect(result2.title).toBe("Chat 2");
	});

	test("should handle undefined lastMessageAt as null", () => {
		const chat: ListChat = {
			_id: "chat_123" as any,
			title: "Test",
			createdAt: 1700000000000,
			updatedAt: 1700001000000,
		};

		const result = serializeChat(chat);

		expect(result.lastMessageAt).toBeNull();
	});

	test("should return SerializedChat type", () => {
		const result: SerializedChat = serializeChat(baseChat);

		expect(result).toHaveProperty("id");
		expect(result).toHaveProperty("title");
		expect(result).toHaveProperty("updatedAt");
		expect(result).toHaveProperty("lastMessageAt");
	});

	test("should handle minimum timestamp value", () => {
		const chat: ListChat = {
			...baseChat,
			updatedAt: 1,
			lastMessageAt: 1,
		};

		const result = serializeChat(chat);

		expect(result.updatedAt).toBe(new Date(1).toISOString());
		expect(result.lastMessageAt).toBe(new Date(1).toISOString());
	});

	test("should preserve exact timestamp milliseconds", () => {
		const timestamp = 1700000000456;
		const chat: ListChat = {
			...baseChat,
			updatedAt: timestamp,
			lastMessageAt: timestamp,
		};

		const result = serializeChat(chat);
		const parsedUpdated = new Date(result.updatedAt).getTime();
		const parsedLastMessage = new Date(result.lastMessageAt!).getTime();

		expect(parsedUpdated).toBe(timestamp);
		expect(parsedLastMessage).toBe(timestamp);
	});

	test("should handle chat with null-like title gracefully", () => {
		const chat: ListChat = {
			...baseChat,
			title: "null",
		};

		const result = serializeChat(chat);

		expect(result.title).toBe("null");
		expect(typeof result.title).toBe("string");
	});

	test("should serialize title with newlines", () => {
		const chat: ListChat = {
			...baseChat,
			title: "Line 1\nLine 2",
		};

		const result = serializeChat(chat);

		expect(result.title).toBe("Line 1\nLine 2");
	});

	test("should serialize title with tabs", () => {
		const chat: ListChat = {
			...baseChat,
			title: "Col1\tCol2",
		};

		const result = serializeChat(chat);

		expect(result.title).toBe("Col1\tCol2");
	});

	test("should handle complex ID values", () => {
		const chat: ListChat = {
			...baseChat,
			_id: "chat_abc123-xyz789_test" as any,
		};

		const result = serializeChat(chat);

		expect(result.id).toBe("chat_abc123-xyz789_test");
	});

	test("should be JSON serializable", () => {
		const result = serializeChat(baseChat);
		const jsonString = JSON.stringify(result);
		const parsed = JSON.parse(jsonString);

		expect(parsed.id).toBe(result.id);
		expect(parsed.title).toBe(result.title);
		expect(parsed.updatedAt).toBe(result.updatedAt);
		expect(parsed.lastMessageAt).toBe(result.lastMessageAt);
	});
});
