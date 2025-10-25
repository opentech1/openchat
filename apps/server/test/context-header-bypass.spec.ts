import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@openchat/auth", () => ({
	getSessionFromRequest: vi.fn().mockResolvedValue(null),
}));

import { createContext } from "../src/lib/context";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
	process.env.NODE_ENV = ORIGINAL_NODE_ENV;
	delete process.env.SERVER_HEADER_BYPASS_SECRET;
	delete process.env.SERVER_ALLOW_HEADER_BYPASS;
});

describe("createContext header bypass", () => {
	it("allows header bypass in production when the secret matches", async () => {
		process.env.NODE_ENV = "production";
		process.env.SERVER_HEADER_BYPASS_SECRET = "canary-secret";
		const request = new Request("https://api.example.com/api/electric/v1/shape", {
			headers: {
				"X-Canary-Secret": "canary-secret",
				"X-User-Id": "monitor-user",
			},
		});

		const ctx = await createContext({ context: { request } as any });

		expect(ctx.session?.user.id).toBe("monitor-user");
	});

	it("rejects header bypass in production when the secret is missing", async () => {
		process.env.NODE_ENV = "production";
		process.env.SERVER_HEADER_BYPASS_SECRET = "canary-secret";
		const request = new Request("https://api.example.com/api/electric/v1/shape", {
			headers: {
				"X-User-Id": "monitor-user",
			},
		});

		const ctx = await createContext({ context: { request } as any });

		expect(ctx.session).toBeNull();
	});

	it("rejects header bypass when the secret does not match", async () => {
		process.env.NODE_ENV = "production";
		process.env.SERVER_HEADER_BYPASS_SECRET = "canary-secret";
		const request = new Request("https://api.example.com/api/electric/v1/shape", {
			headers: {
				"X-Canary-Secret": "wrong-secret",
				"X-User-Id": "monitor-user",
			},
		});

		const ctx = await createContext({ context: { request } as any });

		expect(ctx.session).toBeNull();
	});
});
