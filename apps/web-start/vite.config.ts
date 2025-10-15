import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tanstackStart from "@tanstack/react-start/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), TanStackRouterVite(), tanstackStart()],
  resolve: {
    alias: {
      "@start": path.resolve(__dirname, "src"),
      "@web": path.resolve(__dirname, "../web/src"),
      // Shims for Next.js APIs used by shared components
      "next/link": path.resolve(__dirname, "src/shims/next-link.tsx"),
      "next/navigation": path.resolve(__dirname, "src/shims/next-navigation.ts"),
      "next/script": path.resolve(__dirname, "src/shims/next-script.tsx"),
    },
  },
  server: {
    port: 3001,
    strictPort: false,
    proxy: {
      "/rpc": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/auth": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/chat": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/openrouter/models": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173
  }
});
