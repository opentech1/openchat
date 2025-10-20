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
	runtime: "nodejs20.x",
};

export default function handler(request: Request) {
	return getApp().fetch(request);
}
