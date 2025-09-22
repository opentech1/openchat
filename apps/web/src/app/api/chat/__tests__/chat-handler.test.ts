import { describe, expect, it, vi } from "vitest";

import { convertToCoreMessages } from "ai";

import { createChatHandler } from "../chat-handler";

const encoder = new TextEncoder();

describe("createChatHandler", () => {
	it("streams assistant responses with resolved model", async () => {
		const chatModel = { id: "mock-model" };
		const provider = {
			chat: vi.fn().mockReturnValue(chatModel),
		} as any;

		const streamTextImpl = vi.fn().mockImplementation(async ({ model, onChunk, onFinish }) => {
			expect(model).toBe(chatModel);
			await onChunk({ chunk: { type: "text-delta", text: "Hello" } });
			await onFinish();
			return {
				toUIMessageStreamResponse: () => ({
					status: 200,
					headers: new Headers({ "content-type": "text/event-stream" }),
					body: new ReadableStream({
						start(controller) {
							controller.enqueue(encoder.encode("data: done\n\n"));
							controller.close();
						},
					}),
				}),
			};
		});

		const persistMessage = vi.fn().mockResolvedValue({ ok: true });
		const resolveModel = vi.fn().mockResolvedValue({ provider, modelId: "resolved-model" });

		const handler = createChatHandler({
			streamTextImpl,
			convertToCoreMessagesImpl: convertToCoreMessages,
			persistMessage,
			resolveModel,
		});

		const payload = {
			chatId: "chat-1",
			modelId: "test-model",
			messages: [
				{
					id: "user-1",
					role: "user",
					parts: [{ type: "text", text: "Hi" }],
					metadata: { createdAt: new Date().toISOString() },
				},
			],
			apiKey: "test-key",
		};

		const request = new Request("http://localhost/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});

		const response = await handler(request);
		expect(response.status).toBe(200);
		await response.text();

		expect(resolveModel).toHaveBeenCalledTimes(1);
		expect(resolveModel.mock.calls[0][0].payload.modelId).toBe("test-model");
		expect(provider.chat).toHaveBeenCalledWith("resolved-model");

		const assistantCompletion = persistMessage.mock.calls.find(
			(call) => call[0].role === "assistant" && call[0].status === "completed",
		);
		expect(assistantCompletion).toBeDefined();
		expect(assistantCompletion![0].content).toBe("Hello");
	});

	it("returns 400 when modelId is missing", async () => {
		const handler = createChatHandler({
			streamTextImpl: vi.fn(),
			convertToCoreMessagesImpl: convertToCoreMessages,
			persistMessage: vi.fn().mockResolvedValue({ ok: true }),
		});

		const request = new Request("http://localhost/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				chatId: "chat-1",
				messages: [
					{
						id: "user-1",
						role: "user",
						parts: [{ type: "text", text: "Hi" }],
						metadata: { createdAt: new Date().toISOString() },
					},
				],
				apiKey: "test-key",
			}),
		});

		const response = await handler(request);
		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Missing modelId");
	});

	it("returns 400 when apiKey is missing", async () => {
		const handler = createChatHandler({
			streamTextImpl: vi.fn(),
			convertToCoreMessagesImpl: convertToCoreMessages,
			persistMessage: vi.fn().mockResolvedValue({ ok: true }),
		});

		const request = new Request("http://localhost/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				chatId: "chat-1",
				modelId: "test-model",
				messages: [
					{
						id: "user-1",
						role: "user",
						parts: [{ type: "text", text: "Hi" }],
						metadata: { createdAt: new Date().toISOString() },
					},
				],
			}),
		});

		const response = await handler(request);
		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Missing apiKey");
	});
});
