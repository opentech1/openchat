import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "../src/routers";
import { startTestServer, type RunningServer } from "./helpers/testServer";
import type { AddressInfo } from "node:net";

type RecordedRequest = {
	url: URL;
	headers: Record<string, string>;
};

describe("Electric shape proxy", () => {
	let electricServer: Server | null = null;
	let electricBase = "";
	let server: RunningServer | null = null;
	let requests: RecordedRequest[] = [];
	let client: AppRouterClient;

	beforeAll(async () => {
		requests = [];
		electricServer = createServer((req, res) => {
			const address = electricServer?.address() as AddressInfo;
			const origin = `http://127.0.0.1:${address.port}`;
			const url = new URL(req.url ?? "", origin);
			requests.push({ url, headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])) });
			const body = JSON.stringify([
				{ headers: { operation: "insert" }, key: "row-1", value: { id: "row-1" } },
			]);
			res.statusCode = 200;
			res.setHeader("content-type", "application/json");
			res.setHeader("electric-handle", "handle-1");
			res.setHeader("electric-offset", "offset-1");
			res.end(body);
		});
		electricBase = await new Promise<string>((resolve) => {
			electricServer!.listen(0, "127.0.0.1", () => {
				const address = electricServer!.address() as AddressInfo;
				resolve(`http://127.0.0.1:${address.port}`);
			});
		});
		server = await startTestServer({
			ELECTRIC_GATEKEEPER_SECRET: "test-secret",
			ELECTRIC_SERVICE_URL: electricBase,
			DEV_ALLOW_HEADER_BYPASS: "1",
		});
		const link = new RPCLink({ url: `${server.baseURL}/rpc`, headers: async () => ({ "x-user-id": "owner-user" }) });
		client = createORPCClient(link);
	});

	afterAll(async () => {
		await server?.close();
		await new Promise<void>((resolve) => {
			electricServer?.close(() => resolve());
		});
	});

	it("proxies chat shapes via Electric", async () => {
		requests.length = 0;
		const res = await fetch(`${server!.baseURL}/api/electric/shapes/chats?offset=-1`, {
			headers: { "x-user-id": "owner-user" },
		});
		expect(res.status).toBe(200);
		const data = (await res.json()) as unknown;
		expect(Array.isArray(data)).toBe(true);

		expect(requests.length).toBe(1);
		const [req] = requests;
		expect(req.url.searchParams.get("table")).toBe("chat");
		expect(req.url.searchParams.get("params[1]")).toBe("owner-user");
		expect(req.headers.authorization).toMatch(/^Bearer /);
	});

	it("restricts message shapes to chats owned by the requester", async () => {
		requests.length = 0;
		const { id: chatId } = await client.chats.create({ title: "Owned" });

		const ok = await fetch(
			`${server!.baseURL}/api/electric/shapes/messages?offset=-1&chatId=${chatId}`,
			{ headers: { "x-user-id": "owner-user" } },
		);
		expect(ok.status).toBe(200);
		expect(requests.at(-1)?.url.searchParams.get("params[1]")).toBe(chatId);
		await ok.json();

		const forbidden = await fetch(
			`${server!.baseURL}/api/electric/shapes/messages?offset=-1&chatId=${chatId}`,
			{ headers: { "x-user-id": "intruder" } },
		);
		expect(forbidden.status).toBe(404);
		// Ensure no additional request hit Electric for the forbidden call
		expect(requests.length).toBe(1);
	});
});
