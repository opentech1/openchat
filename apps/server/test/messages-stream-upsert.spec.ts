import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import type { AppRouterClient } from "../src/routers";
import { startTestServer, type RunningServer } from "./helpers/testServer";

const USER_ID = "stream-user";

describe("messages.streamUpsert", () => {
	let server: RunningServer;
	let client: AppRouterClient;

	beforeAll(async () => {
		server = await startTestServer();
		const link = new RPCLink({ url: `${server.baseURL}/rpc`, headers: async () => ({ "x-user-id": USER_ID }) });
		client = createORPCClient(link);
	});

	afterAll(async () => {
		if (server) await server.close();
	});

	it("creates and updates assistant message across streaming lifecycle", async () => {
		const { id: chatId } = await client.chats.create({ title: "Streaming" });
		const userResult = await client.messages.streamUpsert({
			chatId,
			messageId: "msg-user",
			role: "user",
			content: "Hello there",
			status: "completed",
		});
		expect(userResult.ok).toBe(true);

		const bootstrap = await client.messages.streamUpsert({
			chatId,
			messageId: "msg-assistant",
			role: "assistant",
			content: "",
			status: "streaming",
		});
		expect(bootstrap.ok).toBe(true);

		const firstChunk = await client.messages.streamUpsert({
			chatId,
			messageId: "msg-assistant",
			role: "assistant",
			content: "Hello",
			status: "streaming",
		});
		expect(firstChunk.ok).toBe(true);

		const secondChunk = await client.messages.streamUpsert({
			chatId,
			messageId: "msg-assistant",
			role: "assistant",
			content: "Hello world",
			status: "streaming",
		});
		expect(secondChunk.ok).toBe(true);

		const completed = await client.messages.streamUpsert({
			chatId,
			messageId: "msg-assistant",
			role: "assistant",
			content: "Hello world!",
			status: "completed",
		});
		expect(completed.ok).toBe(true);

		const messages = await client.messages.list({ chatId });
		const assistant = messages.find((msg) => msg.id === "msg-assistant");
		expect(assistant?.content).toBe("Hello world!");
	});
});
