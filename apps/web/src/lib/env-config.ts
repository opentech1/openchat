/**
 * Environment Variable Configuration
 *
 * Centralized environment variable management with explicit fallback handling.
 * This makes it easy to audit which values are actually being used in production.
 *
 * SECURITY: Complex fallback chains like `process.env.X || process.env.Y || "default"`
 * make it hard to understand which value is actually used. This helper provides:
 * - Explicit fallback tracking
 * - Development warnings when fallbacks are used
 * - Type-safe environment variable access
 * - Clear documentation of all env vars
 */

import { logWarn, logInfo } from "./logger-server";

/**
 * Environment variable access options
 */
export type EnvOptions = {
	/** Default value if env var is not set */
	fallback?: string;
	/** Whether this env var is required (throws if missing and no fallback) */
	required?: boolean;
	/** Whether to warn in development when using fallback */
	warnOnFallback?: boolean;
	/** Description of what this env var is used for (for documentation) */
	description?: string;
};

/**
 * Get environment variable with explicit fallback handling
 *
 * @param key - Environment variable name
 * @param options - Configuration options
 * @returns Environment variable value or fallback
 * @throws Error if required and not found
 *
 * @example
 * ```typescript
 * // Required env var (throws if missing)
 * const apiKey = getEnvVar("OPENROUTER_API_KEY", {
 *   required: true,
 *   description: "OpenRouter API key for LLM access"
 * });
 *
 * // Optional with fallback
 * const port = getEnvVar("PORT", {
 *   fallback: "3000",
 *   warnOnFallback: true,
 *   description: "Server port"
 * });
 * ```
 */
export function getEnvVar(key: string, options: EnvOptions = {}): string {
	const {
		fallback,
		required = false,
		warnOnFallback = true,
		description,
	} = options;

	const value = process.env[key];

	// Value exists - return it
	if (value !== undefined && value !== "") {
		return value;
	}

	// No value and required - throw error
	if (required && !fallback) {
		const errorMsg = `Missing required environment variable: ${key}${description ? ` (${description})` : ""}`;
		throw new Error(errorMsg);
	}

	// No value but has fallback
	if (fallback !== undefined) {
		// Warn in development when using fallbacks
		if (
			warnOnFallback &&
			process.env.NODE_ENV === "development"
		) {
			logWarn(`Using fallback for ${key}`, {
				key,
				fallback,
				description,
				note: "Set this environment variable explicitly to avoid this warning",
			});
		}

		return fallback;
	}

	// No value, not required, no fallback - return empty string
	return "";
}

/**
 * Get environment variable as number
 *
 * @param key - Environment variable name
 * @param options - Configuration options (fallback should be numeric string)
 * @returns Parsed number value
 * @throws Error if value is not a valid number
 */
export function getEnvVarAsNumber(
	key: string,
	options: EnvOptions = {},
): number {
	const value = getEnvVar(key, options);

	const parsed = Number.parseInt(value, 10);

	if (Number.isNaN(parsed)) {
		throw new Error(
			`Environment variable ${key} must be a valid number, got: ${value}`,
		);
	}

	return parsed;
}

/**
 * Get environment variable as boolean
 *
 * @param key - Environment variable name
 * @param options - Configuration options (fallback should be "true" or "false")
 * @returns Boolean value
 */
export function getEnvVarAsBoolean(
	key: string,
	options: EnvOptions = {},
): boolean {
	const value = getEnvVar(key, options);

	// Common truthy values
	return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

/**
 * Validate all required environment variables on startup
 *
 * Call this in your application initialization to fail fast if
 * required environment variables are missing.
 *
 * @example
 * ```typescript
 * // In app initialization
 * validateRequiredEnvVars({
 *   OPENROUTER_API_KEY: "OpenRouter API key",
 *   DATABASE_URL: "Database connection string",
 *   BETTER_AUTH_SECRET: "Authentication secret",
 * });
 * ```
 */
export function validateRequiredEnvVars(
	requiredVars: Record<string, string>,
): void {
	const missing: string[] = [];

	for (const [key, description] of Object.entries(requiredVars)) {
		const value = process.env[key];
		if (!value || value.trim() === "") {
			missing.push(`${key} (${description})`);
		}
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join("\n")}\n\nPlease set these variables in your .env file or environment.`,
		);
	}
}

/**
 * Log all environment variables (for debugging)
 *
 * SECURITY WARNING: Never call this in production! It will expose secrets.
 * Only use in development for debugging environment variable issues.
 */
export function debugPrintEnvVars(filter?: string): void {
	if (process.env.NODE_ENV === "production") {
		logWarn("Attempted to print env vars in production - blocked for security");
		return;
	}

	const envVars = Object.entries(process.env)
		.filter(([key]) => !filter || key.includes(filter))
		.map(([key, value]) => {
			// Redact sensitive values (anything with SECRET, KEY, PASSWORD, TOKEN in name)
			const isSensitive = /SECRET|KEY|PASSWORD|TOKEN|PRIVATE/i.test(key);
			const displayValue = isSensitive
				? value ? `[REDACTED - length: ${value.length}]` : "[NOT SET]"
				: value || "[NOT SET]";

			return { key, value: displayValue };
		});

	logInfo("Environment variables", {
		filter: filter || "all",
		count: envVars.length,
		vars: envVars,
	});
}

/**
 * Common environment variable getters
 *
 * Use these instead of direct process.env access for better type safety
 * and fallback tracking.
 */
export const env = {
	// Node environment
	nodeEnv: () =>
		getEnvVar("NODE_ENV", {
			fallback: "development",
			warnOnFallback: false,
			description: "Node.js environment",
		}),

	// Server configuration
	port: () =>
		getEnvVarAsNumber("PORT", {
			fallback: "3000",
			description: "Server port",
		}),

	// URLs
	appUrl: () =>
		getEnvVar("NEXT_PUBLIC_APP_URL", {
			fallback:
				process.env.NODE_ENV === "production"
					? ""
					: "http://localhost:3000",
			required: process.env.NODE_ENV === "production",
			description: "Public application URL",
		}),

	serverUrl: () =>
		getEnvVar("NEXT_PUBLIC_SERVER_URL", {
			fallback: "http://localhost:3000",
			description: "Backend server URL",
		}),

	// API Keys (optional - validated at runtime when needed)
	// Note: Making this optional at build time because env validation can run during
	// Next.js build phase, but this key is only needed at runtime when API routes are called
	openrouterApiKey: () =>
		getEnvVar("OPENROUTER_API_KEY", {
			required: false,
			description: "OpenRouter API key (optional at build time, validated at runtime)",
		}),

	// Database
	databaseUrl: () =>
		getEnvVar("DATABASE_URL", {
			required: false,
			description: "Database connection URL",
		}),

	// Feature flags
	enableAnalytics: () =>
		getEnvVarAsBoolean("ENABLE_ANALYTICS", {
			fallback: "false",
			description: "Enable PostHog analytics",
		}),

	// Rate limiting
	chatCreateRateLimit: () =>
		getEnvVarAsNumber("CHAT_CREATE_RATE_LIMIT", {
			fallback: "10",
			description: "Chat creation rate limit (requests per window)",
		}),

	chatCreateWindowMs: () =>
		getEnvVarAsNumber("CHAT_CREATE_WINDOW_MS", {
			fallback: "60000",
			description: "Chat creation rate limit window (milliseconds)",
		}),

	// WorkOS AuthKit
	workosClientId: () =>
		getEnvVar("WORKOS_CLIENT_ID", {
			required: false,
			description: "WorkOS Client ID for AuthKit",
		}),

	workosApiKey: () =>
		getEnvVar("WORKOS_API_KEY", {
			required: false,
			description: "WorkOS API Key for AuthKit",
		}),

	workosRedirectUri: () =>
		getEnvVar("WORKOS_REDIRECT_URI", {
			fallback: "http://localhost:3000/api/auth/callback",
			description: "WorkOS OAuth redirect URI",
		}),

	workosCookiePassword: () =>
		getEnvVar("WORKOS_COOKIE_PASSWORD", {
			required: false,
			description: "WorkOS cookie encryption password (min 32 chars)",
		}),
} as const;
