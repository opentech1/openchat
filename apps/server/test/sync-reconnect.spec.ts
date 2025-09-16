import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type RunningServer } from "./helpers/testServer";
import { isDbAvailable } from "./helpers/db";
import WebSocket from "ws";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "../src/routers";
import { Client } from "pg";

let server: RunningServer;

async function migrate(dbUrl: string) {
	const client = new Client({ connectionString: dbUrl });
	await client.connect();
	await client.query(`
		CREATE TABLE IF NOT EXISTS chat (
			id text PRIMARY KEY,
			user_id text NOT NULL,
			title text,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now(),
			last_message_at timestamptz
		);
		CREATE INDEX IF NOT EXISTS chat_user_idx ON chat(user_id);
		CREATE TABLE IF NOT EXISTS message (
			id text PRIMARY KEY,
			chat_id text NOT NULL,
			role text NOT NULL,
			content text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS message_chat_idx ON message(chat_id);
		CREATE INDEX IF NOT EXISTS message_chat_created_idx ON message(chat_id, created_at);
	`);
	await client.end();
}

describe("duplicate guard on reconnect", () => {
  const DB_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/openchat_test";
  let DB_READY = true;
  beforeAll(async () => {
    if (!process.env.CI) {
      DB_READY = await isDbAvailable(DB_URL);
    }
    if (!DB_READY) return;
    await migrate(DB_URL);
    server = await startTestServer({ DATABASE_URL: DB_URL });
  });
  afterAll(async () => {
    if (server) await server.close();
  });

  it(DB_READY ? "does not re-deliver past events on reconnect" : "skipped: DB not available", async () => {
    if (!DB_READY) return; // skip locally if DB missing
		const user = "user-A";
		const link = new RPCLink({ url: `${server.baseURL}/rpc`, headers: async () => ({ "x-user-id": user }) });
		const client: AppRouterClient = createORPCClient(link);
		const { id: chatId } = await client.chats.create({ title: "Reconn" });
		expect(chatId).toBeTruthy();

		const ws1 = new WebSocket(`${server.baseURL.replace(/^http/, "ws")}/sync?x-user-id=${user}`);
		await new Promise<void>((r, j) => { ws1.once("open", () => r()); ws1.once("error", (e) => j(e)); });
		ws1.send(JSON.stringify({ op: "sub", topic: `chat:${chatId}` }));

		let gotIds = new Set<string>();
		const onMsg = (raw: WebSocket.RawData) => {
			try {
				const m = JSON.parse(raw.toString());
				if (m.type === "chat.new") gotIds.add(m.data.messageId);
			} catch {}
		};
		ws1.on("message", onMsg);

		// Send once
		await client.messages.send({ chatId, content: "hello" });
		await new Promise((r) => setTimeout(r, 300));
		const firstCount = gotIds.size;
		expect(firstCount).toBeGreaterThanOrEqual(2); // user + assistant

		// Reconnect and resubscribe
		ws1.off("message", onMsg);
		ws1.close();
		await new Promise((r) => setTimeout(r, 100));
		const ws2 = new WebSocket(`${server.baseURL.replace(/^http/, "ws")}/sync?x-user-id=${user}`);
		await new Promise<void>((r, j) => { ws2.once("open", () => r()); ws2.once("error", (e) => j(e)); });
		ws2.send(JSON.stringify({ op: "sub", topic: `chat:${chatId}` }));

		let dup = false;
		const onMsg2 = (raw: WebSocket.RawData) => {
			try {
				const m = JSON.parse(raw.toString());
				if (m.type === "chat.new" && gotIds.has(m.data.messageId)) dup = true;
			} catch {}
		};
		ws2.on("message", onMsg2);
		await new Promise((r) => setTimeout(r, 300));
		expect(dup).toBe(false);
		ws2.off("message", onMsg2);
		ws2.close();
	});
});
