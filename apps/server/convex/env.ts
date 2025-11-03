/**
 * Environment variable validation for Convex backend
 * Convex doesn't support external validation libraries, so we do manual validation
 */

export interface ConvexEnv {
	// Required
	NEXT_PUBLIC_APP_URL: string;
	BETTER_AUTH_SECRET: string;
	
	// Required for OAuth (at least one provider)
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	
	// Optional
	AUTH_COOKIE_PREFIX?: string;
	NODE_ENV?: "development" | "production" | "test";
}

/**
 * Validates required environment variables for Convex
 */
export function validateConvexEnv(): ConvexEnv {
	const errors: string[] = [];
	const isProd = process.env.NODE_ENV === "production";
	
	// Apply development defaults only in non-production environments
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || (!isProd ? "http://localhost:3001" : undefined);
	const authSecret = process.env.BETTER_AUTH_SECRET || (!isProd ? "dev-secret" : undefined);
	
	// Check required variables
	if (!appUrl) {
		errors.push("NEXT_PUBLIC_APP_URL is required");
	} else {
		try {
			new URL(appUrl);
		} catch {
			errors.push("NEXT_PUBLIC_APP_URL must be a valid URL");
		}
	}
	
	if (!authSecret) {
		errors.push("BETTER_AUTH_SECRET is required");
	} else if (authSecret === "dev-secret" && isProd) {
		errors.push("BETTER_AUTH_SECRET must not be 'dev-secret' in production");
	}
	
	// Check OAuth providers - at least one should be configured
	const hasGithub = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET;
	const hasGoogle = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
	
	if (!hasGithub && !hasGoogle) {
		console.warn(
			"⚠️  No OAuth providers configured. " +
			"Set GITHUB_CLIENT_ID/SECRET or GOOGLE_CLIENT_ID/SECRET to enable social login."
		);
	}
	
	if (errors.length > 0) {
		console.error("❌ Invalid environment variables for Convex:");
		errors.forEach((error) => console.error(`  - ${error}`));
		console.error("\nPlease check your Convex environment variables.");
		console.error("See .env.example for reference.\n");
		throw new Error("Convex environment validation failed");
	}
	
	return {
		NEXT_PUBLIC_APP_URL: appUrl!,
		BETTER_AUTH_SECRET: authSecret!,
		GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
		GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
		AUTH_COOKIE_PREFIX: process.env.AUTH_COOKIE_PREFIX,
		NODE_ENV: process.env.NODE_ENV as "development" | "production" | "test" | undefined,
	};
}

/**
 * Get a required environment variable or throw
 */
export function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Environment variable ${key} is required but not set`);
	}
	return value;
}

/**
 * Get an optional environment variable with default
 */
export function getEnv(key: string, defaultValue: string): string {
	return process.env[key] || defaultValue;
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
	return process.env.NODE_ENV === "production";
}
