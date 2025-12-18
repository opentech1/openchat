import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import { betterAuth } from "better-auth";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";

/**
 * Better Auth component client for Convex integration.
 * Provides adapter for database operations and helper methods.
 */
export const authComponent = createClient<DataModel>(components.betterAuth);

/**
 * Create Better Auth instance with GitHub OAuth only.
 * This is called for each request to get a fresh auth instance with context.
 * 
 * IMPORTANT: authConfig and the convex plugin must be created inside this function
 * because CONVEX_SITE_URL is not available at module load time in Convex.
 */
export const createAuth = (
	ctx: GenericCtx<DataModel>,
	{ optionsOnly } = { optionsOnly: false }
) => {
	// Get URLs at runtime - CONVEX_SITE_URL is the base for OAuth callbacks
	const convexSiteUrl = process.env.CONVEX_SITE_URL!;
	const siteUrl = process.env.SITE_URL || "http://localhost:3000";
	
	// Build authConfig at runtime when CONVEX_SITE_URL is available
	const authConfig = {
		providers: [getAuthConfigProvider()],
	};
	
	const auth = betterAuth({
		// Disable logging when createAuth is called just to generate options
		logger: {
			disabled: optionsOnly,
		},
		// Use Convex site URL as baseURL so OAuth callbacks work correctly
		baseURL: convexSiteUrl,
		database: authComponent.adapter(ctx),
		// GitHub OAuth only - no email/password
		emailAndPassword: {
			enabled: false,
		},
		socialProviders: {
			github: {
				clientId: process.env.GITHUB_CLIENT_ID!,
				clientSecret: process.env.GITHUB_CLIENT_SECRET!,
			},
		},
		// Trust both the Convex site and the frontend site
		trustedOrigins: [convexSiteUrl, siteUrl],
		plugins: [
			// Required for Convex compatibility - pass authConfig for JWT configuration
			convex({ authConfig }),
			// Enable cross-domain auth for frontend on different domain (localhost:3000 -> convex.site)
			crossDomain({ siteUrl }),
		],
	});
	
	return auth;
};

/**
 * Get the currently authenticated user from Better Auth.
 * Returns null if not authenticated.
 */
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		return authComponent.getAuthUser(ctx);
	},
});
