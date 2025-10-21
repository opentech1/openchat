import { createApp } from "../src/app";

let appInstance: ReturnType<typeof createApp> | null = null;

function getApp() {
	if (appInstance) return appInstance;
	try {
		appInstance = createApp();
		return appInstance;
	} catch (error) {
		console.error("[server] Failed to initialise Elysia app", error);
		throw error;
	}
}

export const config = {
	runtime: "nodejs",
};

export default async function handler(request: Request) {
	const app = getApp();
	const originalUrl = new URL(request.url);
	const strippedPath = originalUrl.pathname.replace(/^\/api/, "") || "/";
	const targetUrl = new URL(strippedPath + originalUrl.search, originalUrl.origin);

	const init: RequestInit = {
		method: request.method,
		headers: request.headers,
		body: request.method === "GET" || request.method === "HEAD" ? null : request.body,
	};

	const proxiedRequest = new Request(targetUrl.toString(), init);
	return app.fetch(proxiedRequest);
}
