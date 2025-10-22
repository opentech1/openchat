import type { createApp as CreateAppFactory } from "../src/app";

type AppFactory = typeof CreateAppFactory;
type AppInstance = ReturnType<AppFactory>;

let appPromise: Promise<AppInstance> | null = null;

const preferCompiledBundle = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const compiledBundleSpecifier = "../dist/index.js";

async function loadFactory(): Promise<AppFactory> {
	if (preferCompiledBundle) {
		try {
			const module = await import(compiledBundleSpecifier);
			const createApp = (module as { createApp?: AppFactory }).createApp;
			if (typeof createApp === "function") {
				return createApp;
			}
			throw new Error(
				"[server] Compiled bundle missing createApp export; ensure dist/index.js re-exports createApp"
			);
		} catch (error) {
			console.error("[server] Failed to load compiled app bundle", error);
			const cause = error instanceof Error ? error : undefined;
			const message =
				"[server] Unable to load compiled app bundle from dist/index.js; rebuild the server package";
			throw cause ? new Error(message, { cause }) : new Error(message);
		}
	}

	// In local development (Bun) importing the TypeScript source is fine.
	if (preferCompiledBundle) {
		console.warn("[server] Compiled bundle unavailable; falling back to TypeScript source app module.");
	} else {
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
