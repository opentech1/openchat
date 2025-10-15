import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tanstackStart from "@tanstack/react-start/vite";

export default defineConfig({
  plugins: [react(), TanStackRouterVite(), tanstackStart()],
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
    },
  },
  preview: {
    port: 4173
  }
});
