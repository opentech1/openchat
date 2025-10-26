import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { auth } from "@openchat/auth";
import { appRouter, inMemoryChatOwned } from "./routers";
import { createContext } from "./lib/context";
import { db } from "./db";
import { chat } from "./db/schema/chat";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { isIP } from "node:net";
import {
	DEFAULT_GATEKEEPER_TABLES,
	DEFAULT_GATEKEEPER_TTL,
	GATEKEEPER_SCHEMA,
	makeGatekeeperToken,
} from "./lib/gatekeeper";
import { parseForwardedHeader } from "./lib/forwarded";

const ORIGIN_ENV_KEYS = [
	"CORS_ORIGIN",
	"CORS_ORIGINS",
	"ALLOWED_WEB_ORIGINS",
	"SERVER_ALLOWED_ORIGINS",
	"NEXT_PUBLIC_APP_URL",
	"NEXT_PUBLIC_SITE_URL",
	"NEXT_PUBLIC_WEB_URL",
	"NEXT_PUBLIC_BASE_URL",
	"NEXT_PUBLIC_ORIGIN",
	"NEXT_PUBLIC_SERVER_URL",
];
const DEFAULT_DEV_ORIGIN = "http://localhost:3001";
const STATIC_ALLOWED_ORIGINS = [
	"https://osschat.dev",
	"https://www.osschat.dev",
	"https://api.osschat.dev",
];
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function normalizeOriginValue(value: string | null | undefined) {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed === "*") return null;
	const maybeWithScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
	try {
		return new URL(maybeWithScheme).origin;
	} catch {
		return null;
	}
}

function expandOrigins(value: string | string[] | null | undefined) {
	if (!value) return [] as string[];
	const parts = Array.isArray(value) ? value : value.split(",");
	return parts
		.map((part) => normalizeOriginValue(part))
		.filter((origin): origin is string => Boolean(origin));
}

function resolveAllowedOrigins(extra?: string | string[]) {
	const origins = new Set<string>();
	for (const origin of STATIC_ALLOWED_ORIGINS) {
		const normalized = normalizeOriginValue(origin);
		if (normalized) origins.add(normalized);
	}
	for (const envKey of ORIGIN_ENV_KEYS) {
		const envValue = process.env[envKey];
		for (const origin of expandOrigins(envValue)) {
			origins.add(origin);
		}
	}
	for (const origin of expandOrigins(extra ?? null)) {
		origins.add(origin);
	}
	for (const key of ["VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"]) {
		const value = process.env[key];
		if (!value) continue;
		const withProtocol = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
		const normalized = normalizeOriginValue(withProtocol);
		if (normalized) origins.add(normalized);
	}
	return origins;
}

const ALLOWED_WEB_ORIGINS = (() => {
	const origins = resolveAllowedOrigins();
	if (origins.size === 0 && !IS_PRODUCTION) {
		origins.add(DEFAULT_DEV_ORIGIN);
	}
	if (process.env.NODE_ENV !== "test") {
		console.log("[server] Allowed CORS origins", Array.from(origins));
	}
	return origins;
})();

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const DEFAULT_ALLOWED_HEADERS = ["Content-Type", "Authorization", "X-Requested-With", "X-User-Id"];

function appendVary(headers: Headers, value: string) {
	const existing = headers.get("Vary");
	if (!existing) {
		headers.set("Vary", value);
		return;
	}
	const parts = existing.split(",").map((part) => part.trim().toLowerCase());
	if (!parts.includes(value.toLowerCase())) {
		headers.set("Vary", `${existing}, ${value}`);
	}
}

function resolveRequestOrigin(request: Request) {
	const origin = request.headers.get("origin");
	if (!origin) return null;
	const normalized = normalizeOriginValue(origin);
	if (!normalized) return null;
	if (ALLOWED_WEB_ORIGINS.has(normalized)) return normalized;
	try {
		const requestOrigin = new URL(request.url).origin;
		if (normalized === requestOrigin) {
			return normalized;
		}
	} catch {}
	console.warn("[server] Blocked CORS origin", { origin: normalized });
	return null;
}

function buildAllowedHeaders(request: Request) {
	const requested = request.headers.get("access-control-request-headers");
	if (!requested) return DEFAULT_ALLOWED_HEADERS.join(", ");
	const headers = new Set(DEFAULT_ALLOWED_HEADERS);
	for (const part of requested.split(",")) {
		const trimmed = part.trim();
		if (trimmed) headers.add(trimmed);
	}
	return Array.from(headers).join(", ");
}

function applyCorsHeaders(headers: Headers, request: Request, origin: string) {
	headers.set("Access-Control-Allow-Origin", origin);
	headers.set("Access-Control-Allow-Credentials", "true");
	headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
	headers.set("Access-Control-Allow-Headers", buildAllowedHeaders(request));
	headers.set("Access-Control-Max-Age", "86400");
	appendVary(headers, "Origin");
}

function handleCorsPreflight(request: Request) {
	const origin = resolveRequestOrigin(request);
	if (!origin) {
		const headers = new Headers();
		appendVary(headers, "Origin");
		return withSecurityHeaders(new Response(null, { status: 204, headers }), request);
	}
	const headers = new Headers();
	applyCorsHeaders(headers, request, origin);
	return withSecurityHeaders(new Response(null, { status: 204, headers }), request);
}

const ELECTRIC_BASE_URL = (process.env.ELECTRIC_SERVICE_URL || process.env.NEXT_PUBLIC_ELECTRIC_URL || "").replace(/\/$/, "");
const ELECTRIC_SOURCE_ID = process.env.ELECTRIC_SOURCE_ID?.trim();
const HAS_ELECTRIC = Boolean(ELECTRIC_BASE_URL && ELECTRIC_SOURCE_ID);

const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});
const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

const IS_BUN_RUNTIME = typeof (globalThis as any).Bun !== "undefined" && (globalThis as any).Bun !== null;

let anonymousRateBucketWarningLogged = false;

// Basic in-memory rate limiter (per-IP, 60 req/min)
const RATE_WINDOW_MS = 60_000;
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const RATE_CLEANUP_INTERVAL = RATE_WINDOW_MS;
let lastRateCleanup = Date.now();
const TRUST_PROXY_FORWARDED = (() => {
	const value = String(process.env.TRUST_PROXY_FORWARDED || "").toLowerCase();
	return value === "true" || value === "1" || value === "yes";
})();

type ServerLike = {
	requestIP?: (request: Request) => { address?: string | null } | null;
} | null | undefined;

function getClientIp(request: Request, server?: ServerLike) {
	const socketAddress = server?.requestIP?.(request);
	const directIp = socketAddress?.address;
	if (directIp && isIP(directIp)) return directIp;
	if (TRUST_PROXY_FORWARDED) {
		const forwardedIp = parseForwardedHeader(request.headers.get("x-forwarded-for"));
		if (forwardedIp) return forwardedIp;
		const realIp = request.headers.get("x-real-ip");
		if (realIp) {
			const sanitized = realIp.trim();
			if (sanitized && isIP(sanitized)) return sanitized;
		}
	}
	return null;
}

function pruneExpiredBuckets(now: number) {
	if (now - lastRateCleanup < RATE_CLEANUP_INTERVAL) return;
	lastRateCleanup = now;
	for (const [key, bucket] of rateMap.entries()) {
		if (now > bucket.resetAt) rateMap.delete(key);
	}
}

const GATEKEEPER_ALLOWED_TABLES = new Set(DEFAULT_GATEKEEPER_TABLES.map((t) => t.toLowerCase()));
function isRateLimited(request: Request, server?: ServerLike) {
	const now = Date.now();
	pruneExpiredBuckets(now);
	const ip = getClientIp(request, server);
	const bucketKey = ip ?? "__anonymous__";
	if (!ip && !anonymousRateBucketWarningLogged) {
		console.warn("[server] Falling back to anonymous rate-limit bucket. Set TRUST_PROXY_FORWARDED=1 if behind a proxy.");
		anonymousRateBucketWarningLogged = true;
	}
	const bucket = rateMap.get(bucketKey);
	if (!bucket || now > bucket.resetAt) {
		rateMap.set(bucketKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return false;
	}
	bucket.count += 1;
	if (bucket.count > RATE_LIMIT) return true;
	return false;
}

function withSecurityHeaders(resp: Response, request?: Request) {
	const headers = new Headers(resp.headers);
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Frame-Options", "SAMEORIGIN");
	headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
	appendVary(headers, "Accept-Encoding");
	if (request) {
		const origin = resolveRequestOrigin(request);
		if (origin) {
			applyCorsHeaders(headers, request, origin);
		} else if (request.headers.has("origin")) {
			appendVary(headers, "Origin");
		}
	}
	// Opportunistic gzip without external deps; preserves streaming
	try {
		const accept = request?.headers.get("accept-encoding") || "";
		const alreadyEncoded = headers.get("Content-Encoding");
		if (!alreadyEncoded && accept.includes("gzip") && resp.body) {
			const hasCS = (globalThis as any).CompressionStream;
			const cs = hasCS ? new (globalThis as any).CompressionStream("gzip") : null;
			if (cs) {
				const compressed = (resp.body as any).pipeThrough(cs);
				headers.set("Content-Encoding", "gzip");
				headers.delete("Content-Length");
				return new Response(compressed, { status: resp.status, statusText: resp.statusText, headers });
			}
		}
	} catch {
		/* no-op */
	}
	return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

type ElectricShapeScope = "chats" | "messages";

function deriveScopeFromQuery(url: URL): ElectricShapeScope | null {
	const scopeParam = url.searchParams.get("scope");
	if (scopeParam === "chats" || scopeParam === "messages") {
		return scopeParam;
	}
	const table = url.searchParams.get("table");
	if (table === "chat") return "chats";
	if (table === "message") return "messages";
	return null;
}

async function proxyElectricShape({
	scope,
	request,
	userId,
	url,
}: {
	scope: ElectricShapeScope;
	request: Request;
	userId: string;
	url: URL;
}) {
	const passthroughParams = new URLSearchParams();
	url.searchParams.forEach((value, key) => {
		const lower = key.toLowerCase();
		if (lower === "scope" || lower === "chatid" || lower === "where" || lower === "table" || lower === "source_id") return;
		if (lower.startsWith("params[")) return;
		passthroughParams.append(key, value);
	});

	let allowTables = DEFAULT_GATEKEEPER_TABLES.slice();
	let chatIdParam: string | null = null;
	switch (scope) {
		case "chats": {
			allowTables = ["chat"];
			break;
		}
		case "messages": {
			chatIdParam = url.searchParams.get("chatId");
			if (!chatIdParam) {
				return withSecurityHeaders(new Response("Missing chatId", { status: 400 }), request);
			}
			try {
				const owned = await db
					.select({ id: chat.id })
					.from(chat)
					.where(and(eq(chat.id, chatIdParam), eq(chat.userId, userId)));
				if (owned.length === 0 && !inMemoryChatOwned(userId, chatIdParam)) {
					return withSecurityHeaders(new Response("Not Found", { status: 404 }), request);
				}
			} catch (error) {
				if (process.env.NODE_ENV !== "test") console.error("chat.verify", error);
				if (!inMemoryChatOwned(userId, chatIdParam)) {
					return withSecurityHeaders(new Response("Not Found", { status: 404 }), request);
				}
			}
			allowTables = ["message"];
			break;
		}
	}

	const tokenInfo = makeGatekeeperToken({
		userId,
		workspaceId: userId,
		tables: allowTables,
	});

	const upstreamHeaders = new Headers();
	if (tokenInfo) {
		upstreamHeaders.set("authorization", `Bearer ${tokenInfo.token}`);
	}
	const ifNoneMatch = request.headers.get("if-none-match");
	if (ifNoneMatch) upstreamHeaders.set("if-none-match", ifNoneMatch);

	let parsedBase: URL;
	try {
		parsedBase = new URL(ELECTRIC_BASE_URL);
	} catch (error) {
		console.error("electric.fetch invalid ELECTRIC_SERVICE_URL", ELECTRIC_BASE_URL, error);
		return withSecurityHeaders(new Response("Electric service misconfigured", { status: 500 }), request);
	}

	const baseCandidates: string[] = [parsedBase.origin];
	const fallbackPorts: string[] = [];
	const fallbackPortEnv = process.env.ELECTRIC_FALLBACK_PORT?.trim();
	if (fallbackPortEnv) {
		fallbackPorts.push(fallbackPortEnv);
	} else if (parsedBase.port === "3010") {
		fallbackPorts.push("3000");
	}

	for (const port of fallbackPorts) {
		try {
			const candidate = new URL(parsedBase.toString());
			candidate.port = port;
			const origin = candidate.origin;
			if (!baseCandidates.includes(origin)) {
				baseCandidates.push(origin);
			}
		} catch (error) {
			if (process.env.NODE_ENV !== "test") {
				console.warn("electric.fetch fallback skipped", { port, error });
			}
		}
	}

	const fallbackDelayRaw = process.env.ELECTRIC_FALLBACK_DELAY_MS;
	const fallbackDelayMs =
		typeof fallbackDelayRaw === "string" && fallbackDelayRaw.trim().length > 0 ? Math.max(0, Number(fallbackDelayRaw)) : 150;

	const buildTarget = (base: string) => {
		const target = new URL(`${base}/v1/shape`);
		passthroughParams.forEach((value, key) => {
			target.searchParams.set(key, value);
		});
		if (ELECTRIC_SOURCE_ID) {
			target.searchParams.set("source_id", ELECTRIC_SOURCE_ID);
		}
		switch (scope) {
			case "chats":
				target.searchParams.set("table", "chat");
				target.searchParams.set("where", `"user_id" = $1`);
				target.searchParams.set("params[1]", userId);
				target.searchParams.set("columns", "id,title,updated_at,last_message_at,user_id");
				break;
			case "messages": {
				target.searchParams.set("table", "message");
				target.searchParams.set("where", `"chat_id" = $1`);
				target.searchParams.set("params[1]", chatIdParam ?? "");
				target.searchParams.set("columns", "id,chat_id,role,content,created_at,updated_at");
				break;
			}
		}
		return target;
	};

	let upstreamResponse: Response | null = null;
	let lastError: unknown = null;
	for (const [candidateIndex, base] of baseCandidates.entries()) {
		const target = buildTarget(base);
		try {
			const response = await fetch(target, {
				method: "GET",
				headers: upstreamHeaders,
			});
			if (response.status >= 400) {
				let errorBody: string | null = null;
				try {
					errorBody = await response.text();
				} catch {}
				const logPayload = {
					status: response.status,
					base,
					scope,
					target: target.toString(),
					message: errorBody?.slice(0, 500) ?? null,
				};
				lastError = new Error(`electric responded ${response.status} for ${base}`);
				console.error("electric.fetch", logPayload);
				if (candidateIndex < baseCandidates.length - 1 && fallbackDelayMs > 0) {
					await new Promise((resolve) => setTimeout(resolve, fallbackDelayMs));
				}
				continue;
			}
			upstreamResponse = response;
			break;
		} catch (error) {
			lastError = error;
			if (candidateIndex < baseCandidates.length - 1 && fallbackDelayMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, fallbackDelayMs));
			}
		}
	}

	if (!upstreamResponse) {
		console.error("electric.fetch", lastError);
		return withSecurityHeaders(new Response("Electric service unreachable", { status: 504 }), request);
	}

	const headers = new Headers(upstreamResponse.headers);
	headers.delete("content-encoding");
	headers.delete("content-length");

	const proxied = new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers,
	});
	return withSecurityHeaders(proxied, request);
}

export function createApp() {
	const app = new Elysia({
		adapter: IS_BUN_RUNTIME ? undefined : node(),
	});

	app.options("/*", ({ request }) => handleCorsPreflight(request));

	app.all("/api/auth/*", async (context) => {
		if (isRateLimited(context.request, context.server)) {
			return withSecurityHeaders(new Response("Too Many Requests", { status: 429 }), context.request);
		}
		try {
			const response = await auth.handler(context.request);
			return withSecurityHeaders(response, context.request);
		} catch (error) {
			console.error("[auth] request failed", error);
			return withSecurityHeaders(new Response("Internal Server Error", { status: 500 }), context.request);
		}
	});

	app.post("/api/electric/gatekeeper", async (context) => {
		if (isRateLimited(context.request, context.server)) {
			return withSecurityHeaders(new Response("Too Many Requests", { status: 429 }), context.request);
		}
		const ctx = await createContext({ context });
		const userId = ctx.session?.user?.id;
		if (!userId) {
			return withSecurityHeaders(new Response("Unauthorized", { status: 401 }), context.request);
		}
		let parsed: z.infer<typeof GATEKEEPER_SCHEMA>;
		try {
			const body = await context.request.json();
			parsed = GATEKEEPER_SCHEMA.parse(body ?? {});
		} catch (error) {
			if (error instanceof z.ZodError) {
				const resp = new Response(JSON.stringify({ ok: false, issues: error.issues }), {
					status: 422,
					headers: { "content-type": "application/json" },
				});
				return withSecurityHeaders(resp, context.request);
			}
			return withSecurityHeaders(new Response("Invalid JSON payload", { status: 400 }), context.request);
		}
		const requestedTables = (parsed.tables && parsed.tables.length > 0 ? parsed.tables : DEFAULT_GATEKEEPER_TABLES)
			.map((t) => t.toLowerCase())
			.filter((table) => GATEKEEPER_ALLOWED_TABLES.has(table));
		if (requestedTables.length === 0) {
			return withSecurityHeaders(new Response("Forbidden", { status: 403 }), context.request);
		}
		let workspaceId = parsed.workspaceId != null ? parsed.workspaceId.trim() : userId;
		if (!workspaceId) {
			return withSecurityHeaders(new Response("Forbidden", { status: 403 }), context.request);
		}
		if (workspaceId !== userId) {
			return withSecurityHeaders(new Response("Forbidden", { status: 403 }), context.request);
		}
		const ttlSeconds = parsed.ttlSeconds ?? DEFAULT_GATEKEEPER_TTL;
		let tokenInfo;
		try {
			tokenInfo = makeGatekeeperToken({
				userId,
				workspaceId,
				tables: requestedTables,
				ttlSeconds,
			});
		} catch (error) {
			console.error("/api/electric/gatekeeper", error);
			return withSecurityHeaders(new Response("Server configuration error", { status: 500 }), context.request);
		}
		const response = new Response(
			JSON.stringify({
				token: tokenInfo ? tokenInfo.token : null,
				expiresAt: tokenInfo ? new Date(tokenInfo.expiresAtSeconds * 1000).toISOString() : null,
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		);
		return withSecurityHeaders(response, context.request);
	});

	app.all("/rpc*", async (context) => {
		if (context.request.method === "OPTIONS") {
			return handleCorsPreflight(context.request);
		}
		const method = context.request.method.toUpperCase();
		if (method !== "POST") {
			return withSecurityHeaders(new Response("Method Not Allowed", { status: 405 }), context.request);
		}
		if (isRateLimited(context.request, context.server)) {
			return withSecurityHeaders(new Response("Too Many Requests", { status: 429 }), context.request);
		}
		const { response } = await rpcHandler.handle(context.request, {
			prefix: "/rpc",
			context: await createContext({ context }),
		});
		const res = response ?? new Response("Not Found", { status: 404 });
		return withSecurityHeaders(res, context.request);
	});

	app.all("/api/electric/v1/shape", async (context) => {
		if (!HAS_ELECTRIC) {
			return withSecurityHeaders(new Response("Electric service not configured", { status: 501 }), context.request);
		}
		if (context.request.method === "OPTIONS") {
			return handleCorsPreflight(context.request);
		}
		if (context.request.method !== "GET") {
			return withSecurityHeaders(new Response("Method Not Allowed", { status: 405 }), context.request);
		}
		const requestUrl = new URL(context.request.url);
		const scope = deriveScopeFromQuery(requestUrl);
		if (!scope) {
			return withSecurityHeaders(new Response("Unknown shape scope", { status: 404 }), context.request);
		}
		const ctx = await createContext({ context });
		const userId = ctx.session?.user?.id;
		if (!userId) {
			return withSecurityHeaders(new Response("Unauthorized", { status: 401 }), context.request);
		}
		return proxyElectricShape({
			scope,
			request: context.request,
			userId,
			url: requestUrl,
		});
	});

	app.get("/api/electric/shapes/:scope", async (context) => {
		if (!HAS_ELECTRIC) {
			return withSecurityHeaders(new Response("Electric service not configured", { status: 501 }), context.request);
		}
		const params = context.params as { scope?: string };
		const scopeParam = params.scope;
		if (scopeParam !== "chats" && scopeParam !== "messages") {
			return withSecurityHeaders(new Response("Unknown shape scope", { status: 404 }), context.request);
		}
		const requestUrl = new URL(context.request.url);
		const ctx = await createContext({ context });
		const userId = ctx.session?.user?.id;
		if (!userId) {
			return withSecurityHeaders(new Response("Unauthorized", { status: 401 }), context.request);
		}
		return proxyElectricShape({
			scope: scopeParam,
			request: context.request,
			userId,
			url: requestUrl,
		});
	});

	app.all("/api*", async (context) => {
		console.log(
			JSON.stringify({
				ts: Date.now(),
				lvl: "info",
				msg: "api",
				m: context.request.method,
				u: new URL(context.request.url).pathname,
			}),
		);
		if (context.request.method === "OPTIONS") {
			return handleCorsPreflight(context.request);
		}
		if (isRateLimited(context.request, context.server)) {
			return withSecurityHeaders(new Response("Too Many Requests", { status: 429 }), context.request);
		}
		const { response } = await apiHandler.handle(context.request, {
			prefix: "/api",
			context: await createContext({ context }),
		});
		const res = response ?? new Response("Not Found", { status: 404 });
		return withSecurityHeaders(res, context.request);
	});

	app.get("/", () => "OK");
	app.get("/health", () => ({ ok: true }));

	return app;
}
