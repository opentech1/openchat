import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// Create auth client with baseURL for standalone Better Auth
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
	plugins: [convexClient()],
});
