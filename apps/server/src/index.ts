import "./env";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { auth } from "@openchat/auth";
import { appRouter, inMemoryChatOwned } from "./routers";
import { createContext } from "./lib/context";
import { hub, makeEnvelope } from "./lib/sync-hub";
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

const ELECTRIC_BASE_URL = (process.env.ELECTRIC_SERVICE_URL || process.env.NEXT_PUBLIC_ELECTRIC_URL || "").replace(/\/$/, "");
const HAS_ELECTRIC = Boolean(ELECTRIC_BASE_URL);

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

const WEB_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3001";

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
	return "0.0.0.0";
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
	const bucket = rateMap.get(ip);
	if (!bucket || now > bucket.resetAt) {
		rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return false;
	}
	const nextCount = bucket.count + 1;
	bucket.count = nextCount;
	if (nextCount > RATE_LIMIT) return true;
	return false;
}

function withSecurityHeaders(resp: Response, request?: Request) {
  const headers = new Headers(resp.headers);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.append("Vary", "Accept-Encoding");
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
  } catch { /* no-op */ }
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

const PORT = Number(process.env.PORT || 3000);

new Elysia()
    .use(
        cors({
            origin: WEB_ORIGIN,
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "x-user-id"],
            credentials: true,
        }),
    )
	.all("/api/auth/*", async (context) => {
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
	})
	.ws("/sync", {
        // Authenticate and greet
        open: async (ws) => {
            const ctx = await createContext({ context: ws.data as any });
            const userId = ctx.session?.user?.id;
            if (!userId) {
                try { ws.send("unauthorized"); } catch {}
                return ws.close(1008, "unauthorized");
            }
            // attach user & tab info
            (ws as any).data.userId = userId;
            try {
                const url = new URL((ws as any).data.request.url);
                const tabId = url.searchParams.get("tabId") || crypto.randomUUID?.() || String(Date.now());
                (ws as any).data.tabId = tabId;
            } catch {
                (ws as any).data.tabId = crypto.randomUUID?.() || String(Date.now());
            }
            // hello event with envelope shape; use user's index topic for topic field
            try {
                const topic = `chats:index:${userId}`;
                const hello = makeEnvelope(topic, "system.hello", { serverTime: Date.now() });
                ws.send(JSON.stringify(hello));
            } catch {}
        },
        // Handle client commands
        message: async (ws, msg) => {
            const userId: string | undefined = (ws as any).data?.userId;
            if (!userId) return ws.close(1008, "unauthorized");

            // message framing: accept string ops or JSON
            try {
                if (typeof msg === "string") {
                    if (msg === "ping") return void ws.send("pong");
                    // try parse json string
                    try { msg = JSON.parse(msg); } catch { /* ignore */ }
                }
                // array form: [op, payload]
                if (Array.isArray(msg) && msg.length > 0) {
                    const [op, payload] = msg as any[];
                    return handleOp(ws, userId, op, payload);
                }
                // object form: { op, topic }
                if (msg && typeof msg === "object" && "op" in (msg as any)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { op, ...rest } = msg as any;
                    return handleOp(ws, userId, op, rest);
                }
            } catch {
                // ignore malformed messages
            }
        },
        close: (ws) => {
            try { hub.unsubscribeAll(ws as any); } catch {}
        },
    })
    .post("/api/electric/gatekeeper", async (context) => {
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
    })
    .all("/rpc*", async (context) => {
		const method = context.request.method.toUpperCase();
		if (method === "OPTIONS") {
			return withSecurityHeaders(new Response(null, { status: 204 }), context.request);
		}
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
    })
    .all("/api*", async (context) => {
        console.log(JSON.stringify({ ts: Date.now(), lvl: "info", msg: "api", m: context.request.method, u: new URL(context.request.url).pathname }));
		if (isRateLimited(context.request, context.server)) {
            return withSecurityHeaders(new Response("Too Many Requests", { status: 429 }), context.request);
        }
        const { response } = await apiHandler.handle(context.request, {
            prefix: "/api",
            context: await createContext({ context }),
        });
        const res = response ?? new Response("Not Found", { status: 404 });
        return withSecurityHeaders(res, context.request);
    })
    .get("/api/electric/shapes/:scope", async (context) => {
        if (!HAS_ELECTRIC) {
            return withSecurityHeaders(new Response("Electric service not configured", { status: 501 }), context.request);
        }
        const { scope } = context.params as { scope?: string };
        if (!scope) {
            return withSecurityHeaders(new Response("Missing shape scope", { status: 400 }), context.request);
        }
        const ctx = await createContext({ context });
        const userId = ctx.session?.user?.id;
        if (!userId) {
            return withSecurityHeaders(new Response("Unauthorized", { status: 401 }), context.request);
        }

        const url = new URL(context.request.url);
        const passthroughParams = new URLSearchParams();
        const allowed = ["offset", "handle", "cursor", "live", "replica", "columns"];
        for (const key of allowed) {
            const value = url.searchParams.get(key);
            if (value !== null) passthroughParams.set(key, value);
        }

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
                    return withSecurityHeaders(new Response("Missing chatId", { status: 400 }), context.request);
                }
                try {
                    const owned = await db
                        .select({ id: chat.id })
                        .from(chat)
                        .where(and(eq(chat.id, chatIdParam), eq(chat.userId, userId)));
                    if (owned.length === 0) {
                        if (!inMemoryChatOwned(userId, chatIdParam)) {
                            return withSecurityHeaders(new Response("Not Found", { status: 404 }), context.request);
                        }
                    }
                } catch (error) {
                    if (process.env.NODE_ENV !== "test") console.error("chat.verify", error);
                    if (!inMemoryChatOwned(userId, chatIdParam)) {
                        return withSecurityHeaders(new Response("Not Found", { status: 404 }), context.request);
                    }
                }
                allowTables = ["message"];
                break;
            }
            default:
                return withSecurityHeaders(new Response("Unknown shape scope", { status: 404 }), context.request);
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
        const ifNoneMatch = context.request.headers.get("if-none-match");
        if (ifNoneMatch) upstreamHeaders.set("if-none-match", ifNoneMatch);

        const baseCandidates = [ELECTRIC_BASE_URL];
        const baseWithoutPort = ELECTRIC_BASE_URL.replace(/:\\d+$/, "");
        const candidate3000 = `${baseWithoutPort}:3000`;
        if (!baseCandidates.includes(candidate3000)) {
            baseCandidates.push(candidate3000);
        }

        const buildTarget = (base: string) => {
            const target = new URL(`${base}/v1/shape`);
            passthroughParams.forEach((value, key) => {
                target.searchParams.set(key, value);
            });
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
        for (const base of baseCandidates) {
            const target = buildTarget(base);
            try {
                const response = await fetch(target, {
                    method: "GET",
                    headers: upstreamHeaders,
                });
                if (response.status < 500) {
                    upstreamResponse = response;
                    break;
                }
                lastError = new Error(`electric responded ${response.status}`);
            } catch (error) {
                lastError = error;
            }
        }

        if (!upstreamResponse) {
            console.error("electric.fetch", lastError);
            return withSecurityHeaders(new Response("Electric service unreachable", { status: 504 }), context.request);
        }

        const headers = new Headers(upstreamResponse.headers);
        headers.delete("content-encoding");
        headers.delete("content-length");

        const proxied = new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers,
        });
        return withSecurityHeaders(proxied, context.request);
    })
    .get("/", () => "OK")
    .get("/health", () => ({ ok: true }))
	.listen(PORT, () => {
		console.log(`Server is running on http://localhost:${PORT}`);
	});

async function handleOp(ws: any, userId: string, op: string, payload?: any) {
    if (op === "ping") return void ws.send("pong");
    if (op === "sub") {
        const topic: string | undefined = payload?.topic;
        if (!topic) return;
        // authorize topic
        if (topic === `chats:index:${userId}`) {
            const res = hub.subscribe(ws, topic);
            if (!res.ok) ws.send(JSON.stringify({ op: "error", error: res.reason || "subscribe_failed" }));
            return;
        }
        if (topic.startsWith("chat:")) {
            const chatId = topic.slice("chat:".length);
            if (!chatId) return;
            try {
                const rows = await db.select({ id: chat.id }).from(chat).where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
                if (rows.length === 0 && !inMemoryChatOwned(userId, chatId)) return; // unauthorized
            } catch (error) {
                if (process.env.NODE_ENV !== "test") console.error("chat.verify", error);
                // On db error, deny to be safe unless memory cache knows the chat
                if (!inMemoryChatOwned(userId, chatId)) return;
            }
            const res = hub.subscribe(ws, topic);
            if (!res.ok) ws.send(JSON.stringify({ op: "error", error: res.reason || "subscribe_failed" }));
            return;
        }
        // Unknown topic family -> ignore
        return;
    }
    if (op === "unsub") {
        const topic: string | undefined = payload?.topic;
        if (!topic) return;
        try { hub.unsubscribe(ws, topic); } catch {}
        return;
    }
}
