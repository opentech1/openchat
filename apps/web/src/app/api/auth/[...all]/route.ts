import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import Database from "better-sqlite3";

// Create and configure database (singleton)
const db = new Database(process.cwd() + "/.auth.db");
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

// Create auth instance as singleton
const auth = betterAuth({
	database: db,
	databaseType: "sqlite",
	secret: process.env.BETTER_AUTH_SECRET || "dev-secret",
	baseURL,
	socialProviders,
	plugins: [nextCookies()],
	trustedOrigins: [baseURL],
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // 1 day
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},
	advanced: {
		generateSchema: true,
		useSecureCookies: process.env.NODE_ENV === "production",
		crossSubDomainCookies: {
			enabled: false,
		},
		cookiePrefix: "openchat",
	},
});

// Export as Next.js App Router handlers
export async function GET(request: Request) {
	return await auth.handler(request);
}

export async function POST(request: Request) {
	return await auth.handler(request);
}
