import type { createApp as CreateAppFactory } from "../../src/app";

type AppFactory = typeof CreateAppFactory;
type AppInstance = Awaited<ReturnType<AppFactory>>;

let appPromise: Promise<AppInstance> | null = null;

const preferCompiledBundle = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const runningOnVercel = preferCompiledBundle;
const compiledBundleSpecifier = "../../dist/index.js";
const bundleMissingExportMessage =
	"[server] Compiled bundle missing createApp export; ensure dist/index.js re-exports createApp";
const bundleLoadFailureMessage =
	"[server] Unable to load compiled app bundle from dist/index.js; rebuild the server package";
const sourceLoadFailureMessage =
	"[server] Unable to load source app bundle from src/app; verify build inputs are present";
const bundleFallbackMessage = "[server] Falling back to source app bundle after compiled import failure";

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
const STATIC_ALLOWED_ORIGINS = [
	"https://osschat.dev",
	"https://www.osschat.dev",
	"https://api.osschat.dev",
];
const DEFAULT_DEV_ORIGIN = "http://localhost:3001";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const DEFAULT_ALLOWED_HEADERS = ["Content-Type", "Authorization", "X-Requested-With", "X-User-Id"];

const ALLOWED_WEB_ORIGINS = (() => {
	const origins = new Set<string>();
	for (const origin of STATIC_ALLOWED_ORIGINS) {
		const normalized = normalizeOriginValue(origin);
		if (normalized) origins.add(normalized);
	}
	for (const envKey of ORIGIN_ENV_KEYS) {
		const value = process.env[envKey];
		for (const expanded of expandOrigins(value)) {
			origins.add(expanded);
		}
	}
	for (const key of ["VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"]) {
		const value = process.env[key];
		if (!value) continue;
		const withProtocol = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
		const normalized = normalizeOriginValue(withProtocol);
		if (normalized) origins.add(normalized);
	}
	if (origins.size === 0 && !IS_PRODUCTION) {
		origins.add(DEFAULT_DEV_ORIGIN);
	}
	if (process.env.NODE_ENV !== "test") {
		console.log("[server] Allowed CORS origins (entry)", Array.from(origins));
	}
	return origins;
})();

export const config = {
	runtime: "nodejs",
};

export async function handleApiRequest(request: Request) {
	const app = await getAppInstance();
	const originalUrl = new URL(request.url);
	const targetPath = normalizeApiPath(originalUrl.pathname);
	const targetUrl = new URL(targetPath + originalUrl.search, originalUrl.origin);
	const normalizedRequest = new Request(targetUrl.toString(), request);
	const origin = resolveRequestOrigin(request);
	if (normalizedRequest.method.toUpperCase() === "OPTIONS") {
		return new Response(null, { status: 204, headers: buildPreflightHeaders(origin, request) });
	}
	try {
		const upstreamResponse = await app.fetch(normalizedRequest);
		const headers = new Headers(upstreamResponse.headers);
		applyCorsHeaders(headers, origin, request);
		return new Response(upstreamResponse.body, {
			status: upstreamResponse.status,
			statusText: upstreamResponse.statusText,
			headers,
		});
	} catch (error) {
		console.error("[server] API handler error", {
			method: normalizedRequest.method,
			path: targetUrl.pathname,
			originHeader: request.headers.get("origin"),
			error,
		});
		const headers = buildPreflightHeaders(origin, request);
		headers.set("content-type", "text/plain; charset=utf-8");
		return new Response("internal server error", {
			status: 500,
			headers,
		});
	}
}

function normalizeApiPath(pathname: string) {
	const leadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
	if (!leadingSlash.startsWith("/api")) {
		return leadingSlash;
	}
	const [, ...segments] = leadingSlash.split("/").filter(Boolean);
	if (segments.length === 0) return "/api";
	if (segments[0] !== "api") return leadingSlash;
	return `/api/${segments.slice(1).join("/")}`;
}

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

function resolveRequestOrigin(request: Request) {
	const originHeader = request.headers.get("origin");
	if (!originHeader) return null;
	const normalized = normalizeOriginValue(originHeader);
	if (!normalized) return null;
	if (ALLOWED_WEB_ORIGINS.has(normalized)) return normalized;
	try {
		const selfOrigin = new URL(request.url).origin;
		if (normalized === selfOrigin) {
			return normalized;
		}
	} catch {}
	if (process.env.NODE_ENV !== "test") {
		console.warn("[server] Blocked CORS origin", { origin: normalized });
	}
	return normalized; // echo origin even if not explicitly allowed
}

function buildPreflightHeaders(origin: string | null, request: Request) {
	const headers = new Headers();
	if (request.headers.has("origin")) {
		headers.append("Vary", "Origin");
	}
	headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
	headers.set("Access-Control-Allow-Headers", buildAllowedHeaders(request));
	headers.set("Access-Control-Max-Age", "86400");
	const allowOrigin = origin ?? request.headers.get("origin");
	if (allowOrigin) {
		headers.set("Access-Control-Allow-Origin", allowOrigin);
		headers.set("Access-Control-Allow-Credentials", "true");
	}
	return headers;
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

function applyCorsHeaders(headers: Headers, origin: string | null, request: Request) {
	const allowOrigin = origin ?? request.headers.get("origin");
	if (allowOrigin) {
		headers.set("Access-Control-Allow-Origin", allowOrigin);
		headers.set("Access-Control-Allow-Credentials", "true");
		headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
		headers.set("Access-Control-Allow-Headers", buildAllowedHeaders(request));
		headers.set("Access-Control-Max-Age", "86400");
	}
	if (request.headers.has("origin")) {
		headers.append("Vary", "Origin");
	}
}

async function loadFactory(): Promise<AppFactory> {
	if (preferCompiledBundle) {
		try {
			return await importCompiledBundle();
		} catch (error) {
			console.error(bundleLoadFailureMessage, error);
			if (!runningOnVercel) {
				console.warn(bundleFallbackMessage);
			} else {
				const cause = error instanceof Error ? error : undefined;
				throw cause ? new Error(bundleLoadFailureMessage, { cause }) : new Error(bundleLoadFailureMessage);
			}
		}
	}
	return importSourceBundle();
}

async function importCompiledBundle(): Promise<AppFactory> {
	const specifier = new URL(compiledBundleSpecifier, import.meta.url).href;
	const module = await import(specifier);
	const createApp = (module as { createApp?: AppFactory }).createApp;
	if (typeof createApp === "function") {
		return createApp;
	}
	throw new Error(bundleMissingExportMessage);
}

async function importSourceBundle(): Promise<AppFactory> {
	try {
		const module = await import("../../src/app");
		const createApp = (module as { createApp?: AppFactory }).createApp;
		if (typeof createApp === "function") {
			return createApp;
		}
		throw new Error("[server] Source bundle missing createApp export; ensure src/app.ts exports createApp");
	} catch (error) {
		const cause = error instanceof Error ? error : undefined;
		throw cause ? new Error(sourceLoadFailureMessage, { cause }) : new Error(sourceLoadFailureMessage);
	}
}

async function getAppInstance(): Promise<AppInstance> {
	if (!appPromise) {
		appPromise = loadFactory().then((factory) => factory());
	}
	return appPromise;
}
