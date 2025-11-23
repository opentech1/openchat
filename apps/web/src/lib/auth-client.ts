import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

/**
 * Better Auth client for Convex
 *
 * Uses the simple setup from the official Convex Better Auth docs.
 * The convexClient plugin handles routing to /api/auth/[...all] which proxies to Convex.
 *
 * NOTE: We do NOT use crossDomainClient because:
 * - crossDomainClient is for mobile/Expo apps that can't set browser cookies
 * - For Next.js, the API route handler (/api/auth) runs on the same domain
 * - Regular browser cookies work fine when proxied through our Next.js API
 */
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_APP_URL || "",
	plugins: [convexClient()],
	fetchOptions: {
		credentials: "include",
	},
});
