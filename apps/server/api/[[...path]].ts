import { createApp } from "../src/app";

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
		const strippedPath = originalUrl.pathname.replace(/^\/api/, "") || "/";
		const targetUrl = new URL(strippedPath + originalUrl.search, originalUrl.origin);

		try {
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
	},
};
