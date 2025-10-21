import { createApp } from "../src/app.js";

let appInstance: ReturnType<typeof createApp> | null = null;

function getApp() {
	if (appInstance) return appInstance;
	try {
		appInstance = createApp();
		return appInstance;
	} catch (error) {
		console.error("[server] failed to initialise app", error);
		throw error;
	}
}

export const config = {
	runtime: "nodejs",
};

export default {
	async fetch(request: Request) {
		let app: ReturnType<typeof createApp>;
		try {
			app = getApp();
		} catch (error) {
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
				error instanceof Error ? error.stack || error.message : typeof error === "string" ? error : "Internal Server Error";
			return new Response(message, { status: 500 });
		}
	},
};

function normalizeApiPath(pathname: string) {
	let normalized = pathname;
	while (true) {
		const next = normalized.replace(/^\/api(?:\/|$)/, "/");
		if (next === normalized) break;
		normalized = next;
	}
	if (normalized === "") normalized = "/";
	if (!normalized.startsWith("/")) normalized = `/${normalized}`;
	return normalized;
}
