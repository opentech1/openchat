import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// Create auth client with Convex Better Auth
// The convexClient plugin handles routing to /api/auth/[...all] which uses nextJsHandler()
// baseURL is provided for the Next.js route handler that proxies to Convex
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
	plugins: [convexClient()],
});
