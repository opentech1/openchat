import { describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { makeGatekeeperToken, DEFAULT_GATEKEEPER_TABLES, DEFAULT_GATEKEEPER_TTL } from "../src/lib/gatekeeper";

function decodePayload(token: string) {
	const [, payload] = token.split(".");
	return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("makeGatekeeperToken", () => {
	it("creates a signed token with provided fields", () => {
		const { token, issuedAt, expiresAtSeconds } = makeGatekeeperToken({
			userId: "user-123",
			workspaceId: "workspace-xyz",
			tables: ["chat", "message"],
			ttlSeconds: 120,
			now: () => 1_700_000_000,
			secret: "super-secret",
		});

		expect(typeof token).toBe("string");
		expect(issuedAt).toBe(1_700_000_000);
		expect(expiresAtSeconds).toBe(1_700_000_120);

		const payload = decodePayload(token);
		expect(payload.sub).toBe("user-123");
		expect(payload.workspaceId).toBe("workspace-xyz");
		expect(payload.tables).toEqual(["chat", "message"]);
		expect(payload.iat).toBe(1_700_000_000);
		expect(payload.exp).toBe(1_700_000_120);
	});

	it("falls back to default tables and ttl", () => {
		const { token, expiresAtSeconds } = makeGatekeeperToken({
			userId: "abc",
			workspaceId: "abc",
			tables: [],
			secret: "secret",
		});
		const payload = decodePayload(token);
		expect(payload.tables).toEqual(DEFAULT_GATEKEEPER_TABLES);
		expect(expiresAtSeconds - (payload.iat as number)).toBe(DEFAULT_GATEKEEPER_TTL);
	});

	it("throws when secret is missing", () => {
		expect(() =>
			makeGatekeeperToken({ userId: "u", workspaceId: "w", tables: ["chat"], secret: "" }),
		).toThrow(/ELECTRIC_GATEKEEPER_SECRET/);
	});
});
