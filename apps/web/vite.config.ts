import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
	plugins: [
		tanstackStart({
			// Default app directory (`apps/web/app`) hosts the TanStack Start scaffold during migration.
		}),
		react(),
		tsconfigPaths(),
	],
	server: {
		port: 3001,
		host: true,
	},
	preview: {
		port: 4173,
		host: true,
	},
});
