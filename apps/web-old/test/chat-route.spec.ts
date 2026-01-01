import { describe, expect, it, vi } from "vitest";

import { createChatHandler } from "@/app/api/chat/chat-handler";

vi.mock("@/lib/auth-server", () => ({
	getUserContext: vi.fn().mockResolvedValue({
		isAuthenticated: true,
		userId: "user-123",
		email: "test@example.com",
		name: "Test User",
		image: null,
	}),
}));

vi.mock("@/lib/convex-server", () => ({
	ensureConvexUser: vi.fn().mockResolvedValue("convex-user-123"),
	streamUpsertMessage: vi.fn(),
}));

vi.mock("@/lib/posthog-server", () => ({
	captureServerEvent: vi.fn(),
}));

describe("POST /api/chat", () => {
	it("streams text chunks in order", async () => {
		const encoder = new TextEncoder();
		const convertSpy = vi.fn((messages: any[]) =>
			messages.map((msg) => ({ role: msg.role, content: msg.parts?.[0]?.text ?? "" })),
		);
		const streamSpy = vi.fn(async (opts: any) => {
			if (opts?.onChunk) {
				await opts.onChunk({ chunk: { type: "text-delta", text: "Hello" } });
				await opts.onChunk({ chunk: { type: "text-delta", text: " world" } });
			}
			const response = new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode('data: {"type":"text","text":"Hello"}\n\n'));
						controller.enqueue(encoder.encode('data: {"type":"text","text":" world"}\n\n'));
						controller.close();
					},
				}),
				{ headers: { "Content-Type": "text/event-stream" } },
			);
			if (opts?.onFinish) {
				await opts.onFinish({} as any);
			}
			return {
				toUIMessageStreamResponse: () => response,
			};
		});

		const persistSpy = vi.fn(async () => ({ ok: true }));
		const handler = createChatHandler({
			corsOrigin: "https://example.com",
			convertToCoreMessagesImpl: convertSpy as any,
			streamTextImpl: streamSpy as any,
			provider: { chat: vi.fn(() => ({ id: "mock-model" })) } as any,
			model: "mock-model",
			persistMessage: persistSpy,
		});

		const request = new Request("https://example.com/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				chatId: "chat-123",
				messages: [
					{
						id: "m1",
						role: "user",
						parts: [{ type: "text", text: "Hello world" }],
						metadata: { createdAt: "2024-01-01T00:00:00.000Z" },
					},
				],
			}),
		});

		const response = await handler(request);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toMatch(/text\/event-stream/i);

		let buffer = "";
		const decoder = new TextDecoder();
		const reader = response.body!.getReader();
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
		}
		buffer += decoder.decode();

		await new Promise((resolve) => setTimeout(resolve, 60));

		expect(buffer).toBe('data: {"type":"text","text":"Hello"}\n\ndata: {"type":"text","text":" world"}\n\n');

		const calls = persistSpy.mock.calls.map((call) => call[0]);
		expect(calls).toEqual([
			{
				userId: "convex-user-123",
				chatId: "chat-123",
				clientMessageId: "m1",
				role: "user",
				content: "Hello world",
				createdAt: "2024-01-01T00:00:00.000Z",
				status: "completed",
				attachments: undefined,
			},
			{
				userId: "convex-user-123",
				chatId: "chat-123",
				clientMessageId: expect.any(String),
				role: "assistant",
				content: "",
				createdAt: expect.any(String),
				status: "streaming",
			},
			{
				userId: "convex-user-123",
				chatId: "chat-123",
				clientMessageId: expect.any(String),
				role: "assistant",
				content: "Hello world",
				reasoning: undefined,
				thinkingTimeMs: undefined,
				createdAt: expect.any(String),
				status: "completed",
			},
		]);

		expect(convertSpy).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ role: "user" }),
			]),
		);
		expect(streamSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				model: expect.anything(),
				messages: expect.arrayContaining([
					expect.objectContaining({ role: "user" }),
				]),
			}),
		);
	});
});
