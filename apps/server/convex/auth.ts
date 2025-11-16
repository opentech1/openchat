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
	// Skip validation during static analysis (optionsOnly mode)
	// Environment variables aren't available during Convex module analysis
	if (!optionsOnly) {
		ensureValidated();
	}

	const env = validateConvexEnv();
	const siteUrl = env.NEXT_PUBLIC_APP_URL;

	// Build socialProviders object dynamically based on available credentials
	const socialProviders: Record<string, any> = {};

	// GitHub OAuth
	if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
		socialProviders.github = {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
		};
	}

	// Google OAuth
	if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
		socialProviders.google = {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		};
	}

	const authSecret = env.BETTER_AUTH_SECRET;

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
		trustedOrigins: [
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"https://osschat.dev",
		],
		advanced: {
			useSecureCookies: isProduction(),
			cookiePrefix: getEnv("AUTH_COOKIE_PREFIX", "openchat"),
			// Disable CSRF protection in dev to prevent intermittent 403 errors
			// Production keeps CSRF enabled for security
			disableCSRFCheck: !isProduction(),
		},
		// PERFORMANCE: Configure rate limiting for smooth UX
		// In development, use generous limits to prevent blocking fast navigation
		// In production, use stricter limits for security
		rateLimit: {
			enabled: isProduction(), // Disable rate limiting in dev entirely
			window: 60, // 60 seconds
			max: isProduction() ? 100 : 10000, // 100 req/min in prod, unlimited in dev
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
		// QueryCtx is structurally compatible with GenericCtx<DataModel>
		return authComponent.getAuthUser(ctx as unknown as GenericCtx<DataModel>);
	},
});
