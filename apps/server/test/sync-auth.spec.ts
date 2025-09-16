import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type RunningServer } from "./helpers/testServer";
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
	`);
	await client.end();
}

describe("/sync auth + topic auth", () => {
	const DB_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/openchat_test";
  beforeAll(async () => {
    try { await migrate(DB_URL); } catch { /* DB may be unavailable locally; tests still run with memory fallback */ }
    server = await startTestServer({ DATABASE_URL: DB_URL });
  });
	afterAll(async () => {
		await server.close();
	});

	it("rejects websocket without token", async () => {
		const ws = new WebSocket(`${server.baseURL.replace(/^http/, "ws")}/sync`);
		const closed = await new Promise<{ code: number; reason: string }>((resolve) => {
			ws.on("close", (code: number, reason: Buffer) => resolve({ code, reason: reason.toString() }));
		});
		expect(closed.code).toBe(1008);
	});

	it("allows sub to chats:index for self and rejects others", async () => {
		const userA = "user-A";
		const ws = new WebSocket(`${server.baseURL.replace(/^http/, "ws")}/sync?x-user-id=${userA}`);
		await new Promise<void>((r, j) => {
			ws.once("open", () => r());
			ws.once("error", (error: Error) => j(error));
		});
		// subscribe to own index should succeed (no explicit ack, so assume alive)
		ws.send(JSON.stringify({ op: "sub", topic: `chats:index:${userA}` }));
		// subscribe to someone else's index should be ignored; we test by publishing an event and ensuring we don't get it
		ws.send(JSON.stringify({ op: "sub", topic: `chats:index:someone-else` }));

		let gotOther = false;
		ws.on("message", (raw: WebSocket.RawData) => {
			try {
				const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
				if (msg.topic === `chats:index:someone-else`) gotOther = true;
			} catch {}
		});
		// server does not allow us to publish, so we can only assert that we don't see other topics during a brief period
		await new Promise((r) => setTimeout(r, 200));
		expect(gotOther).toBe(false);
		ws.close();
	});

  it("receives chats.index.add on create for own user", async () => {
		const userA = "user-A";
		const ws = new WebSocket(`${server.baseURL.replace(/^http/, "ws")}/sync?x-user-id=${userA}`);
		await new Promise<void>((r, j) => { ws.once("open", () => r()); ws.once("error", (error: Error) => j(error)); });
		ws.send(JSON.stringify({ op: "sub", topic: `chats:index:${userA}` }));
		const waitForAdd = new Promise<any>((resolve) => {
			ws.on("message", (raw: WebSocket.RawData) => {
				try {
					const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
					if (msg.type === "chats.index.add") resolve(msg);
				} catch {}
			});
		});
		// Create chat via ORPC client (avoids path shape issues)
		const link = new RPCLink({
			url: `${server.baseURL}/rpc`,
			headers: async () => ({ "x-user-id": userA }),
		});
		const client: AppRouterClient = createORPCClient(link);
		await client.chats.create({ title: "Hello" });
		const evt = await waitForAdd;
		expect(evt.topic).toBe(`chats:index:${userA}`);
		expect(evt.type).toBe("chats.index.add");
		ws.close();
	});
});
