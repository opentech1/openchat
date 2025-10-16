import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { account } from "../db/schema/auth";

// Cast away cross-package drizzle type differences so the server can reuse the auth schema safely.
const accountTable = account as any;

const OPENROUTER_PROVIDER_ID = "openrouter";
const OPENROUTER_API_BASE = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
const DEFAULT_SCOPE = process.env.OPENROUTER_SCOPE || "openid offline_access models.read";

export type OpenRouterModelSummary = {
	id: string;
	name: string;
	description?: string;
	contextLength?: number;
	pricing?: {
		prompt?: number | null;
		completion?: number | null;
	};
};

export async function fetchOpenRouterModels(accessToken: string) {
	const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		return { ok: false as const, status: response.status, body: await response.text().catch(() => "") };
	}

	const payload = await response.json().catch(() => ({})) as any;
	const data = Array.isArray(payload?.data) ? payload.data : [];
	const models: OpenRouterModelSummary[] = data
		.map((entry: any) => ({
			id: typeof entry?.id === "string" ? entry.id : typeof entry?.name === "string" ? entry.name : "",
			name: typeof entry?.name === "string" ? entry.name : typeof entry?.id === "string" ? entry.id : "Unknown model",
			description: typeof entry?.description === "string" ? entry.description : undefined,
			contextLength: typeof entry?.context_length === "number" ? entry.context_length : undefined,
			pricing: entry?.pricing && typeof entry.pricing === "object"
				? {
					prompt: typeof entry.pricing?.prompt === "number" ? entry.pricing.prompt : null,
					completion: typeof entry.pricing?.completion === "number" ? entry.pricing.completion : null,
				}
				: undefined,
		}))
		.filter((model: OpenRouterModelSummary) => Boolean(model.id));

	return { ok: true as const, models };
}

export function getApiBase() {
	return OPENROUTER_API_BASE;
}

export function getDefaultScope() {
	return DEFAULT_SCOPE;
}

function getEncryptionKey() {
	const secret = process.env.OPENROUTER_API_KEY_SECRET;
	if (!secret || secret.length < 16) {
		throw new Error("Missing OPENROUTER_API_KEY_SECRET env for encrypting OpenRouter API keys");
	}
	const salt = "openrouter:key-derivation-salt";
	const iterations = 100_000;
	const keyLength = 32; // AES-256-GCM expects 32-byte key
	return pbkdf2Sync(secret, salt, iterations, keyLength, "sha256");
}

function base64UrlEncode(buffer: Buffer) {
	return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
	value = value.replace(/-/g, "+").replace(/_/g, "/");
	const pad = value.length % 4;
	if (pad) value += "=".repeat(4 - pad);
	return Buffer.from(value, "base64");
}

export function encryptApiKey(raw: string) {
	const key = getEncryptionKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const ciphertext = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return `${base64UrlEncode(iv)}.${base64UrlEncode(authTag)}.${base64UrlEncode(ciphertext)}`;
}

export function decryptApiKey(payload: string) {
	const [ivEncoded, tagEncoded, dataEncoded] = payload.split(".");
	if (!ivEncoded || !tagEncoded || !dataEncoded) {
		throw new Error("Invalid OpenRouter API key payload");
	}
	const key = getEncryptionKey();
	const iv = base64UrlDecode(ivEncoded);
	const authTag = base64UrlDecode(tagEncoded);
	const ciphertext = base64UrlDecode(dataEncoded);
	const decipher = createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(authTag);
	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return decrypted.toString("utf8");
}

export async function storeOpenRouterApiKey({
	userId,
	apiKey,
	scope,
}: {
	userId: string;
	apiKey: string;
	scope?: string | null;
}) {
	const now = new Date();
	const recordId = `openrouter-${userId}`;
	const encrypted = encryptApiKey(apiKey);
	await db
		.insert(accountTable)
		.values({
			id: recordId,
			accountId: recordId,
			providerId: OPENROUTER_PROVIDER_ID,
			userId,
			accessToken: encrypted,
			refreshToken: null,
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null,
			scope: scope ?? null,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: accountTable.id,
			set: {
				accountId: recordId,
				accessToken: encrypted,
				scope: scope ?? null,
				updatedAt: now,
				refreshToken: null,
				accessTokenExpiresAt: null,
				refreshTokenExpiresAt: null,
			},
		});
}

export async function getDecryptedApiKey(userId: string) {
	const record = await getOpenRouterAccount(userId);
	if (!record?.accessToken) return null;
	const apiKey = decryptApiKey(record.accessToken);
	return { apiKey, scope: record.scope ?? null };
}
export async function getOpenRouterAccount(userId: string) {
	const recordId = `openrouter-${userId}`;
	const rows = await db
		.select()
		.from(accountTable)
		.where(eq(accountTable.id, recordId))
		.limit(1);
	return rows[0] ?? null;
}

export async function deleteOpenRouterAccount(userId: string) {
	const recordId = `openrouter-${userId}`;
	await db.delete(accountTable).where(eq(accountTable.id, recordId));
}
