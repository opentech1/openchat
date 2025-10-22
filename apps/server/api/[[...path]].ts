import type { createApp as CreateAppFactory } from "../src/app";

type AppFactory = typeof CreateAppFactory;
type AppInstance = Awaited<ReturnType<AppFactory>>;

let appPromise: Promise<AppInstance> | null = null;

const preferCompiledBundle = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const compiledBundleSpecifier = "../dist/index.js";
const bundleMissingExportMessage =
	"[server] Compiled bundle missing createApp export; ensure dist/index.js re-exports createApp";
const bundleLoadFailureMessage =
	"[server] Unable to load compiled app bundle from dist/index.js; rebuild the server package";

export const config = {
	runtime: "nodejs",
};

export default {
	async fetch(request: Request) {
		const app = await getAppInstance();

		const originalUrl = new URL(request.url);
		const targetPath = normalizeApiPath(originalUrl.pathname);
		const targetUrl = new URL(targetPath + originalUrl.search, originalUrl.origin);

		const proxiedRequest = new Request(targetUrl.toString(), request);
		return app.fetch(proxiedRequest);
	},
};

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

async function loadFactory(): Promise<AppFactory> {
	if (preferCompiledBundle) {
		try {
			const module = await import(compiledBundleSpecifier);
			const createApp = (module as { createApp?: AppFactory }).createApp;
			if (typeof createApp === "function") {
				return createApp;
			}
			throw new Error(bundleMissingExportMessage);
		} catch (error) {
			console.error("[server] Failed to load compiled app bundle", error);
			const cause = error instanceof Error ? error : undefined;
			throw cause ? new Error(bundleLoadFailureMessage, { cause }) : new Error(bundleLoadFailureMessage);
		}
	}

	console.debug("[server] Using TypeScript source app module (development).");
	const module = await import("../src/app");
	return module.createApp;
}

export async function getAppInstance(): Promise<AppInstance> {
	if (!appPromise) {
		appPromise = loadFactory().then((factory) => factory());
	}
	return appPromise;
}
