import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";

import {
	mergeNormalizedMessages,
	normalizeMessage,
	normalizeUiMessage,
	toElectricMessageRecord,
} from "@/lib/chat-message-utils";

describe("chat-message-utils", () => {
	it("normalizes camel and snake case timestamps", () => {
		const iso = "2024-01-01T00:00:00.000Z";
		const normalized = normalizeMessage({
			id: "m1",
			role: "assistant",
			content: "hello",
			created_at: iso,
			updatedAt: "2024-01-01T00:01:00.000Z",
		});
		expect(normalized.createdAt.toISOString()).toBe(iso);
		expect(normalized.updatedAt?.toISOString()).toBe(
			"2024-01-01T00:01:00.000Z",
		);
		expect(normalized.role).toBe("assistant");

		const fallback = normalizeMessage({
			id: "m2",
			role: "user",
			content: "hi",
			createdAt: iso,
		});
		expect(fallback.createdAt.toISOString()).toBe(iso);
		expect(fallback.role).toBe("user");
	});

	it("prefers overlay content when longer or newer", () => {
		const base = [
			normalizeMessage({
				id: "m1",
				role: "assistant",
				content: "hi",
				created_at: "2024-01-01T00:00:00.000Z",
			}),
		];
		const overlay = [
			normalizeMessage({
				id: "m1",
				role: "assistant",
				content: "hi there",
				created_at: "2024-01-01T00:00:00.000Z",
				updated_at: "2024-01-01T00:00:10.000Z",
			}),
			normalizeMessage({
				id: "m2",
				role: "user",
				content: "follow up",
				created_at: "2024-01-01T00:01:00.000Z",
			}),
		];

		const merged = mergeNormalizedMessages(base, overlay);
		expect(merged).toHaveLength(2);
		expect(merged[0]).toMatchObject({ id: "m1", content: "hi there" });
		expect(merged[1]).toMatchObject({ id: "m2" });
	});

	it("normalizes UI messages into consistent shape", () => {
		const uiMessage: UIMessage<{ createdAt?: string }> = {
			id: "ui-1",
			role: "assistant",
			parts: [
				{ type: "text", text: "hello" },
				{ type: "text", text: " world" },
			],
			metadata: { createdAt: "2024-01-01T00:00:00.000Z" },
		};
		const normalized = normalizeUiMessage(uiMessage);
		expect(normalized.content).toBe("hello world");
		expect(normalized.createdAt.toISOString()).toBe("2024-01-01T00:00:00.000Z");
	});

	it("formats electric records with fallback updated time", () => {
		const iso = "2024-01-01T00:00:00.000Z";
		const record = toElectricMessageRecord(
			normalizeMessage({
				id: "m1",
				role: "user",
				content: "Test",
				created_at: iso,
			}),
		);
		expect(record.created_at).toBe(iso);
		expect(record.updated_at).toBe(iso);
	});
});
