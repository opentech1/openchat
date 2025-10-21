import { getAppInstance } from "./load-app";

export const config = {
	runtime: "nodejs",
};

export default {
	async fetch(request: Request) {
		let app;
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
