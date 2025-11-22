import { createAuthClient } from "better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";

// Create auth client with Convex Better Auth
// The convexClient plugin handles routing to /api/auth/[...all] which uses nextJsHandler()
// baseURL is provided for the Next.js route handler that proxies to Convex
// Access env var directly to avoid build-time validation
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_APP_URL || "",
	plugins: [
		convexClient(),
		// Enable cross-domain authentication
		// Required because Convex runs on .convex.site but app runs on osschat.dev
		// This plugin verifies OTT and sets session cookies
		crossDomainClient({
			storagePrefix: "openchat",
		}),
	],
});
