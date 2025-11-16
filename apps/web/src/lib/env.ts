import { z } from "zod";

/**
 * Environment variable validation schema
 * Validates required and optional environment variables on startup
 */

// Check if we're in production
const isProdEnv = process.env.NODE_ENV === "production";

// Server-side environment variables
const serverEnvSchema = z.object({
	// Required - with stricter validation in production
	BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required")
		.refine(
			(val) => !isProdEnv || val !== "dev-secret",
			"BETTER_AUTH_SECRET must not be 'dev-secret' in production. Generate a secure secret with: openssl rand -base64 32"
		),

	// Required - URLs should be explicitly set in production
	NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
	NEXT_PUBLIC_SERVER_URL: z.string().url("NEXT_PUBLIC_SERVER_URL must be a valid URL"),
	NEXT_PUBLIC_CONVEX_URL: z.string().url("NEXT_PUBLIC_CONVEX_URL must be a valid URL"),

	// API Keys - Optional (validated at runtime when used)
	// Note: Making this optional at build time because env validation runs during
	// Next.js build/page-data-collection, but API keys are only needed at runtime
	OPENROUTER_API_KEY: z.string().optional(),

	// Optional - URLs
	CONVEX_URL: z.string().url().optional(),
	NEXT_PUBLIC_CONVEX_SITE_URL: z.string().url().optional(),
	SERVER_INTERNAL_URL: z.string().url().optional(),
	INTERNAL_SERVER_URL: z.string().url().optional(),
	SERVER_DIRECT_URL: z.string().url().optional(),
	BETTER_AUTH_URL: z.string().url().optional(),
	AUTH_COOKIE_DOMAIN: z.string().optional(),
	AUTH_COOKIE_PREFIX: z.string().optional(),

	// Optional - Database
	DATABASE_URL: z.string().url().optional(),

	// Optional - Redis
	REDIS_URL: z.string().url().optional(),
	UPSTASH_REDIS_REST_URL: z.string().url().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

	// Optional - Analytics
	NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
	NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
	POSTHOG_API_KEY: z.string().optional(),
	POSTHOG_HOST: z.string().url().optional(),
	POSTHOG_DEPLOYMENT: z.string().optional(),
	POSTHOG_ENVIRONMENT: z.string().optional(),
	POSTHOG_DEPLOYMENT_REGION: z.string().optional(),

	// Optional - Monitoring
	SENTRY_DSN: z.string().url().optional(),
	NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

	// Optional - Vercel
	VERCEL_ENV: z.string().optional(),
	VERCEL_REGION: z.string().optional(),
	VERCEL_GIT_COMMIT_SHA: z.string().optional(),

	// Optional - Development
	NEXT_PUBLIC_DEV_BYPASS_AUTH: z.enum(["0", "1"]).optional(),
	NEXT_PUBLIC_DEV_USER_ID: z.string().optional(),
	NEXT_PUBLIC_ELECTRIC_URL: z.string().url().optional(),

	// Optional - Metadata
	NEXT_PUBLIC_APP_VERSION: z.string().optional(),
	NEXT_PUBLIC_DEPLOYMENT: z.string().optional(),
	APP_VERSION: z.string().optional(),
	DEPLOYMENT: z.string().optional(),

	// Optional - CORS
	CORS_ORIGIN: z.string().optional(),

	// Optional - Cache configuration
	NEXT_PUBLIC_CHAT_PREFETCH_TTL_MS: z.string().regex(/^\d+$/).optional(),
	NEXT_PUBLIC_CHAT_PREFETCH_MAX_SIZE: z.string().regex(/^\d+$/).optional(),
	NEXT_PUBLIC_MODEL_CACHE_TTL_MS: z.string().regex(/^\d+$/).optional(),

	// Optional - Rate limiting configuration
	CHAT_CREATE_RATE_LIMIT: z.string().regex(/^\d+$/).optional(),
	CHAT_CREATE_WINDOW_MS: z.string().regex(/^\d+$/).optional(),
	AUTH_RATE_LIMIT: z.string().regex(/^\d+$/).optional(),
	AUTH_RATE_WINDOW_MS: z.string().regex(/^\d+$/).optional(),

	// Optional - OpenRouter configuration
	OPENROUTER_BASE_URL: z.string().url().optional(),
	OPENROUTER_RATE_LIMIT_PER_MIN: z.string().regex(/^\d+$/).optional(),
	OPENROUTER_RATE_LIMIT_TRACKED_BUCKETS: z.string().regex(/^\d+$/).optional(),
	OPENROUTER_MAX_USER_CHARS: z.string().regex(/^\d+$/).optional(),
	OPENROUTER_STREAM_FLUSH_INTERVAL_MS: z.string().regex(/^\d+$/).optional(),
	OPENROUTER_STREAM_MIN_CHARS_PER_FLUSH: z.string().regex(/^\d+$/).optional(),
	OPENROUTER_STREAM_DELAY_MS: z.string().regex(/^\d+$|^null$/).optional(),
	OPENROUTER_MAX_TOKENS: z.string().regex(/^\d+$/).optional(),
	OPENROUTER_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),

	// Optional - Message limits
	MAX_MESSAGES_PER_REQUEST: z.string().regex(/^\d+$/).optional(),
	MAX_REQUEST_BODY_SIZE: z.string().regex(/^\d+$/).optional(),
	MAX_ATTACHMENT_SIZE: z.string().regex(/^\d+$/).optional(),
	MAX_MESSAGE_CONTENT_LENGTH: z.string().regex(/^\d+$/).optional(),

	// Node environment
	NODE_ENV: z.enum(["development", "production", "test"]).optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
});

// Client-side environment variables (NEXT_PUBLIC_* only)
const clientEnvSchema = z.object({
	NEXT_PUBLIC_APP_URL: z.string().url(),
	NEXT_PUBLIC_SERVER_URL: z.string().url(),
	NEXT_PUBLIC_CONVEX_URL: z.string().url(),
	NEXT_PUBLIC_CONVEX_SITE_URL: z.string().url().optional(),
	NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
	NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
	NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
	NEXT_PUBLIC_DEV_BYPASS_AUTH: z.enum(["0", "1"]).optional(),
	NEXT_PUBLIC_DEV_USER_ID: z.string().optional(),
	NEXT_PUBLIC_ELECTRIC_URL: z.string().url().optional(),
	NEXT_PUBLIC_APP_VERSION: z.string().optional(),
	NEXT_PUBLIC_DEPLOYMENT: z.string().optional(),
	NEXT_PUBLIC_CHAT_PREFETCH_TTL_MS: z.string().regex(/^\d+$/).optional(),
	NEXT_PUBLIC_CHAT_PREFETCH_MAX_SIZE: z.string().regex(/^\d+$/).optional(),
	NEXT_PUBLIC_MODEL_CACHE_TTL_MS: z.string().regex(/^\d+$/).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates server-side environment variables
 * Call this during server startup or in server-side code
 */
export function validateServerEnv(): ServerEnv {
	// Apply defaults only in development
	const envWithDefaults = isProdEnv ? process.env : {
		...process.env,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
		NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL || "http://localhost:3210",
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "dev-secret",
	};
	
	try {
		return serverEnvSchema.parse(envWithDefaults);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues.map((issue) => {
				const path = issue.path.join(".");
				return `  - ${path}: ${issue.message}`;
			});

			// Environment validation errors should always be shown, even in production
			// This helps with deployment debugging
			console.error("❌ Invalid environment variables:");
			console.error(issues.join("\n"));
			console.error("\nPlease check your .env file and ensure all required variables are set.");
			console.error("See .env.example for reference.\n");

			throw new Error("Environment validation failed");
		}
		throw error;
	}
}

/**
 * Validates client-side environment variables
 * Call this in client-side code to ensure NEXT_PUBLIC_* vars are available
 */
export function validateClientEnv(): ClientEnv {
	// Extract only NEXT_PUBLIC_* variables for validation
	// In Next.js, these are embedded at build time and available via process.env
	const env = {
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
		NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
		NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
		NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
		NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
		NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
		NEXT_PUBLIC_DEV_BYPASS_AUTH: process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH,
		NEXT_PUBLIC_DEV_USER_ID: process.env.NEXT_PUBLIC_DEV_USER_ID,
		NEXT_PUBLIC_ELECTRIC_URL: process.env.NEXT_PUBLIC_ELECTRIC_URL,
		NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
		NEXT_PUBLIC_DEPLOYMENT: process.env.NEXT_PUBLIC_DEPLOYMENT,
		NEXT_PUBLIC_CHAT_PREFETCH_TTL_MS: process.env.NEXT_PUBLIC_CHAT_PREFETCH_TTL_MS,
		NEXT_PUBLIC_CHAT_PREFETCH_MAX_SIZE: process.env.NEXT_PUBLIC_CHAT_PREFETCH_MAX_SIZE,
		NEXT_PUBLIC_MODEL_CACHE_TTL_MS: process.env.NEXT_PUBLIC_MODEL_CACHE_TTL_MS,
	};
	
	try {
		return clientEnvSchema.parse(env);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues.map((issue) => {
				const path = issue.path.join(".");
				return `  - ${path}: ${issue.message}`;
			});

			// Environment validation errors should always be shown, even in production
			// This helps with deployment debugging
			console.error("❌ Invalid client environment variables:");
			console.error(issues.join("\n"));

			throw new Error("Client environment validation failed");
		}
		throw error;
	}
}

/**
 * Gets a validated server environment variable
 * Throws an error if validation fails
 */
export function getServerEnv(): ServerEnv {
	return validateServerEnv();
}

/**
 * Gets a validated client environment variable
 * Throws an error if validation fails
 */
export function getClientEnv(): ClientEnv {
	return validateClientEnv();
}

/**
 * Safely get an environment variable with a default
 */
export function getEnvVar(key: string, defaultValue?: string): string {
	const value = process.env[key];
	if (value) return value;
	if (defaultValue !== undefined) return defaultValue;
	throw new Error(`Environment variable ${key} is not set and no default was provided`);
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
	return process.env.NODE_ENV === "production";
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
	return process.env.NODE_ENV === "development";
}

/**
 * Check if we're in test
 */
export function isTest(): boolean {
	return process.env.NODE_ENV === "test";
}
