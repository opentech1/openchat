import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "apps/web/src"),
		},
	},
	root: process.cwd(),
	test: {
		globals: true,
		environment: "node",
		testTimeout: 20000,
		include: ["apps/**/test/**/*.spec.ts"],
		exclude: ["apps/**/tests/**"],
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage",
		},
		pool: "threads",
		poolOptions: { threads: { singleThread: true } },
	},
});
