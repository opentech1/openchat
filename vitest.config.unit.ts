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
		name: "unit",
		globals: true,
		environment: "happy-dom",
		testTimeout: 10000,
		env: {
			NODE_ENV: "development",
		},
		include: [
			"apps/**/test/**/*.spec.ts",
			"apps/**/__tests__/**/*.test.ts",
			"apps/**/convex/**/*.test.ts",
			"packages/**/test/**/*.spec.ts",
			"packages/**/__tests__/**/*.test.ts",
		],
		exclude: [
			"**/*.integration.test.ts",
			"**/*.component.test.tsx",
			"**/e2e/**",
			"**/node_modules/**",
			"**/dist/**",
			"**/.next/**",
		],
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage/unit",
			include: ["apps/*/src/**", "packages/*/src/**"],
			exclude: [
				"**/*.spec.ts",
				"**/*.test.ts",
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
