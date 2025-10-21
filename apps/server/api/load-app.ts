import type { createApp as CreateAppFactory } from "../src/app";

type AppFactory = typeof CreateAppFactory;
type AppInstance = ReturnType<AppFactory>;

let appPromise: Promise<AppInstance> | null = null;

const preferCompiledBundle = process.env.VERCEL === "1" || process.env.VERCEL === "true";

async function loadFactory(): Promise<AppFactory> {
	if (preferCompiledBundle) {
		try {
			const module = await import("../dist/index.js");
			if (typeof module.createApp === "function") {
				return module.createApp;
			}
			console.warn("[server] Compiled bundle missing createApp export; falling back to source app");
		} catch (error) {
			console.error("[server] Failed to load compiled app bundle", error);
		}
	}

	// In local development (Bun) importing the TypeScript source is fine.
	const module = await import("../src/app");
	return module.createApp;
}

export async function getAppInstance(): Promise<AppInstance> {
	if (!appPromise) {
		appPromise = loadFactory().then((factory) => factory());
	}
	return appPromise;
}
