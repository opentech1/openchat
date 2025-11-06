import { betterAuth } from "better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";

const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// betterAuth component is registered via convex.config.ts and properly typed in _generated/api.d.ts
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
	ctx: GenericCtx<DataModel>,
	{ optionsOnly } = { optionsOnly: false },
) => {
	// Build socialProviders object dynamically based on available credentials
	const socialProviders: Record<string, any> = {};

	// GitHub OAuth
	if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
		socialProviders.github = {
			clientId: process.env.GITHUB_CLIENT_ID,
			clientSecret: process.env.GITHUB_CLIENT_SECRET,
		};
	}

	return betterAuth({
		logger: { disabled: optionsOnly },
		baseURL: siteUrl,
		database: authComponent.adapter(ctx),
		secret: process.env.BETTER_AUTH_SECRET || "dev-secret",
		socialProviders,
		plugins: [
			convex(),
		],
		advanced: {
			useSecureCookies: process.env.NODE_ENV === "production",
			cookiePrefix: process.env.AUTH_COOKIE_PREFIX || "openchat",
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
		// QueryCtx is compatible with GenericCtx<DataModel> as it extends it
		return authComponent.getAuthUser(ctx as GenericCtx<DataModel>);
	},
});

