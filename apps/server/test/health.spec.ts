import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type RunningServer } from "./helpers/testServer";

let server: RunningServer;

describe("API health", () => {
	beforeAll(async () => {
		server = await startTestServer();
	});
	afterAll(async () => {
		await server.close();
	});

	it("GET /health returns ok", async () => {
		const res = await fetch(`${server.baseURL}/health`);
		expect(res.ok).toBe(true);
		const json = await res.json();
		expect(json).toEqual({ ok: true });
	});
});

