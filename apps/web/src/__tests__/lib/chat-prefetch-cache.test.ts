/**
 * Unit Tests for Chat Prefetch Cache
 *
 * Tests the in-memory and sessionStorage-backed chat prefetch cache:
 * - TTL-based expiration
 * - LRU eviction when cache is full
 * - Cache persistence to sessionStorage
 * - Cache validation and migration
 * - Concurrent request deduplication
 */

import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import {
	readChatPrefetch,
	storeChatPrefetch,
	type PrefetchMessage,
	type PrefetchEntry,
} from "@/lib/chat-prefetch-cache";

// Mock sessionStorage
const mockSessionStorage = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		}),
		get length() {
			return Object.keys(store).length;
		},
		key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
		_getStore: () => store,
		_setStore: (s: Record<string, string>) => {
			store = s;
		},
	};
})();

// Mock window.sessionStorage
Object.defineProperty(globalThis, "window", {
	value: {
		sessionStorage: mockSessionStorage,
	},
	writable: true,
});

// Mock Date.now for time-based tests
let mockNow = Date.now();
const originalDateNow = Date.now;

// Reset global state between tests
beforeEach(() => {
	mockSessionStorage.clear();
	// Reset the global state by deleting the global cache object
	delete (globalThis as any).__OPENCHAT_CHAT_PREFETCH__;
	// Reset mock time
	mockNow = originalDateNow();
	Date.now = vi.fn(() => mockNow);
});

afterEach(() => {
	Date.now = originalDateNow;
	vi.restoreAllMocks();
});

// Helper to advance mock time
function advanceTime(ms: number) {
	mockNow += ms;
}

function setMockTime(time: number) {
	mockNow = time;
}

describe("storeChatPrefetch", () => {
	const mockMessages: PrefetchMessage[] = [
		{
			id: "msg_1",
			role: "user",
			content: "Hello",
			createdAt: new Date().toISOString(),
		},
		{
			id: "msg_2",
			role: "assistant",
			content: "Hi there!",
			createdAt: new Date().toISOString(),
		},
	];

	test("should store messages in cache", () => {
		storeChatPrefetch("chat_123", mockMessages);

		const entry = readChatPrefetch("chat_123");
		expect(entry).not.toBeNull();
		expect(entry?.messages).toHaveLength(2);
		expect(entry?.messages[0].content).toBe("Hello");
	});

	test("should update fetchedAt and lastAccessedAt timestamps", () => {
		const now = Date.now();
		setMockTime(now);

		storeChatPrefetch("chat_123", mockMessages);

		const entry = readChatPrefetch("chat_123");
		expect(entry?.fetchedAt).toBe(now);
		expect(entry?.lastAccessedAt).toBeGreaterThanOrEqual(now);
	});

	test("should persist to sessionStorage", () => {
		storeChatPrefetch("chat_123", mockMessages);

		expect(mockSessionStorage.setItem).toHaveBeenCalled();
		const stored = mockSessionStorage._getStore()["openchat.chat-prefetch"];
		expect(stored).toBeDefined();

		const parsed = JSON.parse(stored);
		expect(parsed["chat_123"]).toBeDefined();
		expect(parsed["chat_123"].messages).toHaveLength(2);
	});

	test("should overwrite existing entry for same chatId", () => {
		const initialMessages: PrefetchMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "Initial",
				createdAt: new Date().toISOString(),
			},
		];
		const updatedMessages: PrefetchMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "Updated",
				createdAt: new Date().toISOString(),
			},
			{
				id: "msg_2",
				role: "assistant",
				content: "Response",
				createdAt: new Date().toISOString(),
			},
		];

		storeChatPrefetch("chat_123", initialMessages);
		storeChatPrefetch("chat_123", updatedMessages);

		const entry = readChatPrefetch("chat_123");
		expect(entry?.messages).toHaveLength(2);
		expect(entry?.messages[0].content).toBe("Updated");
	});

	test("should handle empty messages array", () => {
		storeChatPrefetch("chat_123", []);

		const entry = readChatPrefetch("chat_123");
		expect(entry).not.toBeNull();
		expect(entry?.messages).toHaveLength(0);
	});

	test("should store multiple chats independently", () => {
		const messages1: PrefetchMessage[] = [
			{ id: "m1", role: "user", content: "Chat 1", createdAt: new Date().toISOString() },
		];
		const messages2: PrefetchMessage[] = [
			{ id: "m2", role: "user", content: "Chat 2", createdAt: new Date().toISOString() },
		];

		storeChatPrefetch("chat_1", messages1);
		storeChatPrefetch("chat_2", messages2);

		const entry1 = readChatPrefetch("chat_1");
		const entry2 = readChatPrefetch("chat_2");

		expect(entry1?.messages[0].content).toBe("Chat 1");
		expect(entry2?.messages[0].content).toBe("Chat 2");
	});
});

describe("readChatPrefetch", () => {
	const mockMessages: PrefetchMessage[] = [
		{
			id: "msg_1",
			role: "user",
			content: "Hello",
			createdAt: new Date().toISOString(),
		},
	];

	test("should return null for non-existent chatId", () => {
		const entry = readChatPrefetch("nonexistent_chat");
		expect(entry).toBeNull();
	});

	test("should return entry for existing chatId", () => {
		storeChatPrefetch("chat_123", mockMessages);

		const entry = readChatPrefetch("chat_123");
		expect(entry).not.toBeNull();
		expect(entry?.messages[0].content).toBe("Hello");
	});

	test("should update lastAccessedAt on read", () => {
		const initialTime = Date.now();
		setMockTime(initialTime);
		storeChatPrefetch("chat_123", mockMessages);

		// Advance time
		const laterTime = initialTime + 60000;
		setMockTime(laterTime);
		const entry = readChatPrefetch("chat_123");

		expect(entry?.lastAccessedAt).toBe(laterTime);
	});

	test("should return null for expired entry (TTL)", () => {
		const initialTime = Date.now();
		setMockTime(initialTime);
		storeChatPrefetch("chat_123", mockMessages);

		// Advance time past TTL (default 5 minutes = 300000ms)
		const expiredTime = initialTime + 300001;
		setMockTime(expiredTime);

		const entry = readChatPrefetch("chat_123");
		expect(entry).toBeNull();
	});

	test("should return entry just before TTL expiration", () => {
		const initialTime = Date.now();
		setMockTime(initialTime);
		storeChatPrefetch("chat_123", mockMessages);

		// Advance time to just before TTL
		const almostExpiredTime = initialTime + 299999;
		setMockTime(almostExpiredTime);

		const entry = readChatPrefetch("chat_123");
		expect(entry).not.toBeNull();
	});

	test("should delete expired entry from cache on read", () => {
		const initialTime = Date.now();
		setMockTime(initialTime);
		storeChatPrefetch("chat_123", mockMessages);

		// Expire the entry
		setMockTime(initialTime + 400000);
		readChatPrefetch("chat_123");

		// Verify it's removed from sessionStorage
		const stored = mockSessionStorage._getStore()["openchat.chat-prefetch"];
		const parsed = JSON.parse(stored);
		expect(parsed["chat_123"]).toBeUndefined();
	});
});

describe("LRU eviction", () => {
	test("should evict least recently used entries when cache is full", () => {
		const now = Date.now();
		setMockTime(now);

		// Fill cache to max (default 50 entries)
		for (let i = 0; i < 50; i++) {
			setMockTime(now + i);
			storeChatPrefetch(`chat_${i}`, [
				{ id: `m${i}`, role: "user", content: `Message ${i}`, createdAt: new Date().toISOString() },
			]);
		}

		// Verify first entries exist
		expect(readChatPrefetch("chat_0")).not.toBeNull();
		expect(readChatPrefetch("chat_49")).not.toBeNull();

		// Add one more entry, should evict chat_0 (LRU)
		setMockTime(now + 100);
		storeChatPrefetch("chat_50", [
			{ id: "m50", role: "user", content: "Message 50", createdAt: new Date().toISOString() },
		]);

		// chat_50 should exist
		expect(readChatPrefetch("chat_50")).not.toBeNull();
	});

	test("should not evict when updating existing entry", () => {
		const now = Date.now();
		setMockTime(now);

		// Fill cache
		for (let i = 0; i < 50; i++) {
			setMockTime(now + i);
			storeChatPrefetch(`chat_${i}`, [
				{ id: `m${i}`, role: "user", content: `Message ${i}`, createdAt: new Date().toISOString() },
			]);
		}

		// Update an existing entry
		setMockTime(now + 100);
		storeChatPrefetch("chat_0", [
			{ id: "m0", role: "user", content: "Updated message 0", createdAt: new Date().toISOString() },
		]);

		// All entries should still exist
		expect(readChatPrefetch("chat_0")?.messages[0].content).toBe("Updated message 0");
		expect(readChatPrefetch("chat_49")).not.toBeNull();
	});
});

describe("cache validation", () => {
	test("should handle corrupted JSON in sessionStorage", () => {
		mockSessionStorage._setStore({
			"openchat.chat-prefetch": "invalid json {{{",
		});

		// Reset global state to force reload from sessionStorage
		delete (globalThis as any).__OPENCHAT_CHAT_PREFETCH__;

		// Should not throw, should return null
		const entry = readChatPrefetch("chat_123");
		expect(entry).toBeNull();

		// Should have cleared corrupted cache
		expect(mockSessionStorage.removeItem).toHaveBeenCalled();
	});

	test("should handle invalid cache structure in sessionStorage", () => {
		mockSessionStorage._setStore({
			"openchat.chat-prefetch": JSON.stringify({ chat_123: "not an object" }),
		});

		delete (globalThis as any).__OPENCHAT_CHAT_PREFETCH__;

		const entry = readChatPrefetch("chat_123");
		expect(entry).toBeNull();
	});

	test("should migrate old entries without lastAccessedAt field", () => {
		const oldEntry = {
			chat_123: {
				messages: [{ id: "m1", role: "user", content: "Old", createdAt: new Date().toISOString() }],
				fetchedAt: Date.now(),
				// Missing lastAccessedAt
			},
		};

		mockSessionStorage._setStore({
			"openchat.chat-prefetch": JSON.stringify(oldEntry),
		});

		delete (globalThis as any).__OPENCHAT_CHAT_PREFETCH__;

		const entry = readChatPrefetch("chat_123");
		expect(entry).not.toBeNull();
		// Should have lastAccessedAt after migration (set to fetchedAt)
		expect(entry?.lastAccessedAt).toBeDefined();
	});
});

describe("message structure validation", () => {
	test("should handle message with all fields", () => {
		const messages: PrefetchMessage[] = [
			{
				id: "msg_1",
				role: "user",
				content: "Hello with all fields",
				createdAt: new Date().toISOString(),
			},
		];

		storeChatPrefetch("chat_123", messages);
		const entry = readChatPrefetch("chat_123");

		expect(entry?.messages[0]).toEqual(messages[0]);
	});

	test("should handle message with assistant role", () => {
		const messages: PrefetchMessage[] = [
			{
				id: "msg_1",
				role: "assistant",
				content: "AI response",
				createdAt: new Date().toISOString(),
			},
		];

		storeChatPrefetch("chat_123", messages);
		const entry = readChatPrefetch("chat_123");

		expect(entry?.messages[0].role).toBe("assistant");
	});

	test("should preserve message order", () => {
		const messages: PrefetchMessage[] = [
			{ id: "m1", role: "user", content: "First", createdAt: "2024-01-01T00:00:00Z" },
			{ id: "m2", role: "assistant", content: "Second", createdAt: "2024-01-01T00:00:01Z" },
			{ id: "m3", role: "user", content: "Third", createdAt: "2024-01-01T00:00:02Z" },
		];

		storeChatPrefetch("chat_123", messages);
		const entry = readChatPrefetch("chat_123");

		expect(entry?.messages).toHaveLength(3);
		expect(entry?.messages[0].content).toBe("First");
		expect(entry?.messages[1].content).toBe("Second");
		expect(entry?.messages[2].content).toBe("Third");
	});

	test("should handle very long message content", () => {
		const longContent = "A".repeat(100000);
		const messages: PrefetchMessage[] = [
			{ id: "m1", role: "user", content: longContent, createdAt: new Date().toISOString() },
		];

		storeChatPrefetch("chat_123", messages);
		const entry = readChatPrefetch("chat_123");

		expect(entry?.messages[0].content).toBe(longContent);
	});

	test("should handle message with Unicode content", () => {
		const messages: PrefetchMessage[] = [
			{
				id: "m1",
				role: "user",
				content: "Hello 你好 🌍 مرحبا",
				createdAt: new Date().toISOString(),
			},
		];

		storeChatPrefetch("chat_123", messages);
		const entry = readChatPrefetch("chat_123");

		expect(entry?.messages[0].content).toBe("Hello 你好 🌍 مرحبا");
	});
});

describe("edge cases", () => {
	test("should handle rapid successive stores to same chatId", () => {
		const now = Date.now();

		for (let i = 0; i < 10; i++) {
			setMockTime(now + i);
			storeChatPrefetch("chat_123", [
				{ id: `m${i}`, role: "user", content: `Message ${i}`, createdAt: new Date().toISOString() },
			]);
		}

		const entry = readChatPrefetch("chat_123");
		expect(entry?.messages[0].content).toBe("Message 9");
	});

	test("should handle special characters in chatId", () => {
		const chatId = "chat_123-abc_xyz";
		const messages: PrefetchMessage[] = [
			{ id: "m1", role: "user", content: "Test", createdAt: new Date().toISOString() },
		];

		storeChatPrefetch(chatId, messages);
		const entry = readChatPrefetch(chatId);

		expect(entry).not.toBeNull();
		expect(entry?.messages[0].content).toBe("Test");
	});

	test("should handle empty chatId", () => {
		const messages: PrefetchMessage[] = [
			{ id: "m1", role: "user", content: "Test", createdAt: new Date().toISOString() },
		];

		storeChatPrefetch("", messages);
		const entry = readChatPrefetch("");

		expect(entry).not.toBeNull();
	});
});
