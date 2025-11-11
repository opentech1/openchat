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
	const warnings: string[] = [];
	const isProd = process.env.NODE_ENV === "production";

	// Apply development defaults only in non-production environments
	// Handle empty strings explicitly - they should trigger defaults too
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || (!isProd ? "http://localhost:3001" : undefined));
	const authSecret = (process.env.BETTER_AUTH_SECRET?.trim() || (!isProd ? "dev-secret" : undefined));

	// Check required variables
	if (!appUrl) {
		if (isProd) {
			errors.push("NEXT_PUBLIC_APP_URL is required");
		} else {
			warnings.push("NEXT_PUBLIC_APP_URL not set, using default: http://localhost:3001");
		}
	} else {
		try {
			new URL(appUrl);
		} catch {
			if (isProd) {
				errors.push("NEXT_PUBLIC_APP_URL must be a valid URL");
			} else {
				warnings.push("NEXT_PUBLIC_APP_URL is not a valid URL, using default");
			}
		}
	}

	if (!authSecret) {
		if (isProd) {
			errors.push("BETTER_AUTH_SECRET is required");
		} else {
			warnings.push("BETTER_AUTH_SECRET not set, using default: dev-secret");
		}
	} else if (authSecret === "dev-secret" && isProd) {
		errors.push("BETTER_AUTH_SECRET must not be 'dev-secret' in production");
	}

	// Check OAuth providers - at least one should be configured
	// Treat empty strings as missing values
	const hasGithub = process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim();
	const hasGoogle = process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim();

	if (!hasGithub && !hasGoogle) {
		warnings.push(
			"No OAuth providers configured. " +
			"Set GITHUB_CLIENT_ID/SECRET or GOOGLE_CLIENT_ID/SECRET to enable social login."
		);
	}

	// Print warnings
	if (warnings.length > 0 && !isProd) {
		console.warn("⚠️  Convex environment warnings:");
		warnings.forEach((warning) => console.warn(`  - ${warning}`));
		console.warn("\nYou can set these via: npx convex env set KEY value");
		console.warn("Or add them to apps/server/.env.local and restart.\n");
	}

	// Only throw errors in production or if critical errors exist
	if (errors.length > 0) {
		console.error("❌ Invalid environment variables for Convex:");
		errors.forEach((error) => console.error(`  - ${error}`));
		console.error("\nPlease check your Convex environment variables.");
		console.error("See .env.example for reference.\n");
		throw new Error("Convex environment validation failed");
	}

	return {
		NEXT_PUBLIC_APP_URL: appUrl || "http://localhost:3001",
		BETTER_AUTH_SECRET: authSecret || "dev-secret",
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
	const value = process.env[key];
	// Handle empty strings properly - return default if undefined or empty
	return value !== undefined && value !== "" ? value : defaultValue;
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
	return process.env.NODE_ENV === "production";
}
