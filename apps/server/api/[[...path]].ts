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

try {
	// Preserve the original request (body, headers, method) while swapping the URL
	const proxiedRequest = new Request(targetUrl.toString(), request);
	return await app.fetch(proxiedRequest);
} catch (error) {
	console.error("[server] request failed", {
		url: request.url,
		target: targetUrl.toString(),
		error,
	});
	return new Response("Internal Server Error", { status: 500 });
}
}
