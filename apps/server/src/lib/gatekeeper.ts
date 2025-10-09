import { createHmac } from "node:crypto";
import { z } from "zod";

export const GATEKEEPER_SCHEMA = z.object({
	workspaceId: z.string().min(1).optional(),
	tables: z.array(z.string().min(1)).optional(),
	ttlSeconds: z.number().int().positive().max(3600).optional(),
});

export const DEFAULT_GATEKEEPER_TABLES = ["chat", "message"] as const;
const ALLOWED_TABLE_SET = new Set(DEFAULT_GATEKEEPER_TABLES.map((t) => t.toLowerCase()));
export const DEFAULT_GATEKEEPER_TTL = 300;

type MakeTokenOptions = {
	userId: string;
	workspaceId: string;
	tables: string[];
	ttlSeconds?: number;
	now?: () => number;
	secret?: string;
};

function base64urlEncode(input: string | Buffer) {
	const buff = typeof input === "string" ? Buffer.from(input) : input;
	return buff.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function makeGatekeeperToken({
	userId,
	workspaceId,
	tables,
	ttlSeconds = DEFAULT_GATEKEEPER_TTL,
	now = () => Math.floor(Date.now() / 1000),
	secret = process.env.ELECTRIC_GATEKEEPER_SECRET,
}: MakeTokenOptions) {
	if (!secret) return null;
	const normalizedTables = (tables && tables.length > 0 ? tables : DEFAULT_GATEKEEPER_TABLES)
		.map((t) => t.toLowerCase())
		.filter((table) => ALLOWED_TABLE_SET.has(table));
	if (normalizedTables.length === 0) {
		throw new Error("No permitted tables requested for gatekeeper token");
	}
	const issuedAt = now();
	const expiresAtSeconds = issuedAt + ttlSeconds;
	const header = { alg: "HS256", typ: "JWT" } as const;
	const payload = {
		sub: userId,
		workspaceId,
		tables: normalizedTables,
		iat: issuedAt,
		exp: expiresAtSeconds,
	};
	const encodedHeader = base64urlEncode(JSON.stringify(header));
	const encodedPayload = base64urlEncode(JSON.stringify(payload));
	const hmac = createHmac("sha256", secret);
	hmac.update(`${encodedHeader}.${encodedPayload}`);
	const signature = base64urlEncode(hmac.digest());
	return {
		token: `${encodedHeader}.${encodedPayload}.${signature}`,
		issuedAt,
		expiresAtSeconds,
		payload,
	};
}

export type GatekeeperInput = z.infer<typeof GATEKEEPER_SCHEMA>;
