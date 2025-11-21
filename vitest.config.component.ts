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
		name: "component",
		globals: true,
		environment: "happy-dom",
		testTimeout: 15000,
		env: {
			NODE_ENV: "development",
		},
		include: [
			"apps/**/*.component.test.tsx",
			"packages/**/*.component.test.tsx",
		],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/.next/**",
			"**/e2e/**",
		],
		setupFiles: ["./test/setup.ts"],
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage/component",
			include: ["apps/*/src/**", "packages/*/src/**"],
			exclude: [
				"**/*.test.tsx",
				"**/*.component.test.tsx",
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
