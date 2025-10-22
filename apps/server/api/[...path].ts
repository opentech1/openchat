import type { createApp as CreateAppFactory } from "../src/app";

type AppFactory = typeof CreateAppFactory;
type AppInstance = ReturnType<AppFactory>;

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
		let app: AppInstance;
		try {
			app = await getAppInstance();
		} catch (error) {
			console.error("[server] failed to load Elysia app", error);
			return new Response("Internal Server Error", { status: 500 });
		}

		const originalUrl = new URL(request.url);
		const targetPath = normalizeApiPath(originalUrl.pathname);
		const targetUrl = new URL(targetPath + originalUrl.search, originalUrl.origin);

		try {
			const proxiedRequest = new Request(targetUrl.toString(), request);
			return await app.fetch(proxiedRequest);
		} catch (error) {
			console.error("[server] request failed", {
				url: request.url,
				target: targetUrl.toString(),
				error,
			});
			const message =
				error instanceof Error
					? error.stack || error.message
					: typeof error === "string"
					? error
					: "Internal Server Error";
			return new Response(message, { status: 500 });
		}
	},
};

function normalizeApiPath(pathname: string) {
	const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
	if (!withLeadingSlash.startsWith("/api")) {
		return withLeadingSlash;
	}
	const [, ...segments] = withLeadingSlash.split("/").filter(Boolean);
	let firstNonApi = 0;
	while (firstNonApi < segments.length && segments[firstNonApi] === "api") {
		firstNonApi += 1;
	}
	const dedupedSegments = ["api", ...segments.slice(firstNonApi)];
	return `/${dedupedSegments.join("/")}`;
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

	if (!preferCompiledBundle) {
		console.debug("[server] Using TypeScript source app module (development).");
	}
	const module = await import("../src/app");
	return module.createApp;
}

export async function getAppInstance(): Promise<AppInstance> {
	if (!appPromise) {
		appPromise = loadFactory().then((factory) => factory());
	}
	return appPromise;
}
