import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Setup localStorage polyfill for MSW before any test code runs
if (typeof global.localStorage === "undefined") {
	const storage = new Map<string, string>();
	(global as any).localStorage = {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => { storage.set(key, value); },
		removeItem: (key: string) => { storage.delete(key); },
		clear: () => { storage.clear(); },
		key: (index: number) => Array.from(storage.keys())[index] ?? null,
		get length() { return storage.size; },
	};
}

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "apps/web/src"),
			"@server": path.resolve(__dirname, "apps/server"),
		},
	},
	root: process.cwd(),
	test: {
		name: "integration",
		globals: true,
		environment: "node",
		testTimeout: 30000,
		env: {
			NODE_ENV: "development",
		},
		setupFiles: [
			"./apps/web/test/setup-globals.ts",  // MUST be first - sets up global polyfills
			"./apps/web/test/setup-integration.ts"
		],
		include: [
			"apps/**/*.integration.test.ts",
			"packages/**/*.integration.test.ts",
		],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/.next/**",
			"**/e2e/**",
			// TODO: Re-enable once MSW localStorage issue is resolved
			// MSW's cookieStore module uses localStorage at import time,
			// which isn't available in Node test environment
			"apps/web/src/app/api/chat/route.integration.test.ts",
		],
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage/integration",
			include: ["apps/*/src/**", "packages/*/src/**"],
			exclude: [
				"**/*.test.ts",
				"**/*.integration.test.ts",
				"**/*.config.*",
				"**/dist/**",
				"**/.next/**",
				"**/node_modules/**",
			],
			reporter: ["text", "json", "html"],
		},
		pool: "threads",
		poolOptions: { threads: { singleThread: true } },
	},
});
