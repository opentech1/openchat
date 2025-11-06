import { betterAuth } from "better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { getEnv, isProduction, validateConvexEnv } from "./env";

// Lazy validation - only validate when auth is actually created
let validated = false;
function ensureValidated() {
	if (!validated) {
		validateConvexEnv();
		validated = true;
	}
}

// betterAuth component is registered via convex.config.ts and properly typed in _generated/api.d.ts
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
	ctx: GenericCtx<DataModel>,
	{ optionsOnly } = { optionsOnly: false },
) => {
	// Validate environment variables on first auth creation
	ensureValidated();
	
	const siteUrl = getEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
	
	// Build socialProviders object dynamically based on available credentials
	const socialProviders: Record<string, any> = {};

	// GitHub OAuth
	if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
		socialProviders.github = {
			clientId: process.env.GITHUB_CLIENT_ID,
			clientSecret: process.env.GITHUB_CLIENT_SECRET,
		};
	}

	// Google (optional - only if credentials provided)
	if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
		socialProviders.google = {
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		};
	}

	const authSecret = getEnv("BETTER_AUTH_SECRET", "dev-secret");

	// Warn if using dev-secret in production
	if (authSecret === "dev-secret" && isProduction()) {
		console.error("⚠️  WARNING: Using dev-secret in production! Generate a secure secret with: openssl rand -base64 32");
	}

	return betterAuth({
		logger: { disabled: optionsOnly },
		baseURL: siteUrl,
		database: authComponent.adapter(ctx),
		secret: authSecret,
		socialProviders,
		plugins: [
			convex(),
		],
		advanced: {
			useSecureCookies: isProduction(),
			cookiePrefix: getEnv("AUTH_COOKIE_PREFIX", "openchat"),
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			freshAge: 60 * 60, // 1 hour
			cookieCache: {
				enabled: true,
				maxAge: 60 * 60, // 1 hour cache
			},
		},
	});
};

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		// QueryCtx is compatible with GenericCtx at runtime - the types are structurally compatible
		// @ts-expect-error - authComponent.getAuthUser expects GenericCtx but query provides QueryCtx which has a compatible structure
		return authComponent.getAuthUser(ctx);
	},
});
