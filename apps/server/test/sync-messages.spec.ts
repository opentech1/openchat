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

describe("message fan-out + sidebar bump", () => {
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

  it(DB_READY ? "broadcasts chat.new to both and bumps sidebar" : "skipped: DB not available", async () => {
    if (!DB_READY) return; // skip locally if DB missing
		const user = "user-A";
		const link = new RPCLink({ url: `${server.baseURL}/rpc`, headers: async () => ({ "x-user-id": user }) });
		const client: AppRouterClient = createORPCClient(link);
		const { id: chatId } = await client.chats.create({ title: "Test" });
		expect(chatId).toBeTruthy();

		const ws1 = new WebSocket(`${server.baseURL.replace(/^http/, "ws")}/sync?x-user-id=${user}`);
		const ws2 = new WebSocket(`${server.baseURL.replace(/^http/, "ws")}/sync?x-user-id=${user}`);
		await Promise.all([
			new Promise<void>((r, j) => { ws1.once("open", () => r()); ws1.once("error", (e) => j(e)); }),
			new Promise<void>((r, j) => { ws2.once("open", () => r()); ws2.once("error", (e) => j(e)); }),
		]);
		const evts1: any[] = [];
		const evts2: any[] = [];
		const onMsg1 = (raw: WebSocket.RawData) => { try { const m = JSON.parse(raw.toString()); evts1.push(m); } catch {} };
		const onMsg2 = (raw: WebSocket.RawData) => { try { const m = JSON.parse(raw.toString()); evts2.push(m); } catch {} };
		ws1.on("message", onMsg1);
		ws2.on("message", onMsg2);
		ws1.send(JSON.stringify({ op: "sub", topic: `chat:${chatId}` }));
		ws1.send(JSON.stringify({ op: "sub", topic: `chats:index:${user}` }));
		ws2.send(JSON.stringify({ op: "sub", topic: `chat:${chatId}` }));
		ws2.send(JSON.stringify({ op: "sub", topic: `chats:index:${user}` }));

		// Send message via RPC client
		const mRes = await client.messages.send({ chatId, content: "hello" });
		expect(mRes.ok).toBe(true);
		// Wait a bit for events to arrive
		await new Promise((r) => setTimeout(r, 400));

		const get = (arr: any[], type: string, topic: string) => arr.filter((e) => e.type === type && e.topic === topic);
		for (const evts of [evts1, evts2]) {
			const chatNews = get(evts, "chat.new", `chat:${chatId}`);
			expect(chatNews.length).toBeGreaterThanOrEqual(2);
			const [userEvt, asstEvt] = chatNews.slice(-2); // last two should be ours
			expect(userEvt.data.role).toBe("user");
			expect(asstEvt.data.role).toBe("assistant");
			expect(new Date(userEvt.data.createdAt).getTime()).toBeLessThan(new Date(asstEvt.data.createdAt).getTime());
			const bumps = get(evts, "chats.index.update", `chats:index:${user}`);
			expect(bumps.length).toBeGreaterThanOrEqual(1);
		}

		ws1.off("message", onMsg1); ws2.off("message", onMsg2);
		ws1.close(); ws2.close();
	});
});
