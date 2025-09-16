import { defineConfig } from "vitest/config";

export default defineConfig({
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
	},
});
