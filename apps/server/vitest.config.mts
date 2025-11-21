import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		// Use edge-runtime environment for Convex tests
		environment: "edge-runtime",
		// Inline convex-test to ensure proper dependency resolution
		server: {
			deps: {
				inline: ["convex-test"],
			},
		},
		// Test file patterns
		include: ["convex/**/*.test.ts"],
		// Set root directory
		root: ".",
		// Coverage configuration
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["convex/**/*.ts"],
			exclude: [
				"convex/**/*.test.ts",
				"convex/_generated/**",
				"convex/node_modules/**",
			],
		},
		// Global test timeout
		testTimeout: 10000,
		// Hooks timeout
		hookTimeout: 10000,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./"),
		},
	},
});
