import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { appRouter } from "./routers";
import { createContext } from "./lib/context";
import { hub, makeEnvelope } from "./lib/sync-hub";
import { db } from "./db";
import { chat } from "./db/schema/chat";
import { and, eq } from "drizzle-orm";

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
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN || 60);
function isRateLimited(request: Request) {
  const now = Date.now();
  const xf = request.headers.get("x-forwarded-for") || "";
  const ip = (xf.split(",")[0] || "127.0.0.1").trim();
  const bucket = rateMap.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 });
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
    .all("/rpc*", async (context) => {
        // basic structured request log
        console.log(JSON.stringify({ ts: Date.now(), lvl: "info", msg: "rpc", m: context.request.method, u: new URL(context.request.url).pathname }));
        if (isRateLimited(context.request)) {
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
        if (isRateLimited(context.request)) {
            return withSecurityHeaders(new Response("Too Many Requests", { status: 429 }), context.request);
        }
        const { response } = await apiHandler.handle(context.request, {
            prefix: "/api",
            context: await createContext({ context }),
        });
        const res = response ?? new Response("Not Found", { status: 404 });
        return withSecurityHeaders(res, context.request);
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
                if (rows.length === 0) return; // unauthorized
            } catch {
                // On db error, deny to be safe
                return;
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
