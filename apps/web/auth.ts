import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import Database from "better-sqlite3";

// Create and configure database
const db = new Database(process.cwd() + "/.auth.db");

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Get base URL from environment
const baseURL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Build social providers from environment variables
const socialProviders: Record<string, any> = {};

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
	socialProviders.github = {
		clientId: process.env.GITHUB_CLIENT_ID,
		clientSecret: process.env.GITHUB_CLIENT_SECRET,
	};
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
	socialProviders.google = {
		clientId: process.env.GOOGLE_CLIENT_ID,
		clientSecret: process.env.GOOGLE_CLIENT_SECRET,
	};
}

// Export auth configuration for CLI
export const auth = betterAuth({
	database: db,
	databaseType: "sqlite",
	secret: process.env.BETTER_AUTH_SECRET || "dev-secret",
	baseURL,
	socialProviders,
	plugins: [nextCookies()],
	trustedOrigins: [baseURL],
	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
		cookiePrefix: process.env.AUTH_COOKIE_PREFIX || "openchat",
	},
});
