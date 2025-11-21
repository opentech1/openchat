import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "apps/web/src"),
			"@server": path.resolve(__dirname, "apps/server"),
		},
	},
	root: process.cwd(),
	test: {
		globals: true,
		environment: "happy-dom",
		testTimeout: 20000,
		include: [
			"apps/**/test/**/*.spec.ts",
			"apps/**/*.test.{ts,tsx}",
			"apps/**/*.component.test.{ts,tsx}",
		],
		exclude: ["apps/**/tests/**"],
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage",
		},
		pool: "threads",
		poolOptions: { threads: { singleThread: true } },
		setupFiles: ["apps/web/src/test/setup.ts"],
	},
});
