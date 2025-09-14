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

new Elysia()
    .use(
        cors({
            origin: WEB_ORIGIN,
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "x-user-id"],
            credentials: true,
        }),
    )
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
	.listen(3000, () => {
		console.log("Server is running on http://localhost:3000");
	});
