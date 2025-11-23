import { createAuthClient } from "better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";

// Create auth client with Convex Better Auth
// The convexClient plugin handles routing to /api/auth/[...all] which uses nextJsHandler()
// baseURL is provided for the Next.js route handler that proxies to Convex
// Access env var directly to avoid build-time validation
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_APP_URL || "",
	// IMPORTANT: credentials: "include" is required for cookies to be sent/received
	// Without this, fetch requests won't include cookies and Set-Cookie headers won't be stored
	fetchOptions: {
		credentials: "include",
	},
	plugins: [
		convexClient(),
		// Enable cross-domain authentication
		// Required because Convex runs on .convex.site but app runs on osschat.dev
		// This plugin handles OTT (one-time token) verification to establish session cookies
		crossDomainClient({
			storagePrefix: "openchat",
		}),
	],
});
