/**
 * Application Constants
 *
 * Centralized constants for the application including API versioning,
 * feature flags, and other global configuration values.
 */

/**
 * API Version
 *
 * VERSIONING STRATEGY:
 * - Current version: v1
 * - Breaking changes require a new version (v2, v3, etc.)
 * - Non-breaking changes (new fields, new endpoints) can be added to existing version
 * - Support at least one previous version during transition period
 *
 * MIGRATION PATH:
 * 1. Add new version endpoints (e.g., /api/v2/chats)
 * 2. Update clients to use new version
 * 3. Monitor usage of old version
 * 4. Deprecate old version after transition period
 * 5. Remove old version after deprecation period
 *
 * BACKWARDS COMPATIBILITY:
 * - /api/chats routes without version prefix are treated as v1 for backwards compatibility
 * - New clients should explicitly use /api/v1/chats
 * - In a future major version, unversioned routes may be removed
 */
export const API_VERSION = "v1" as const;

/**
 * Supported API versions
 *
 * Add new versions here as they are released.
 * Keep old versions during transition period.
 */
export const SUPPORTED_API_VERSIONS = ["v1"] as const;

/**
 * Deprecated API versions
 *
 * Versions in this list will return deprecation warnings but still work.
 * They should be removed after a reasonable transition period.
 */
export const DEPRECATED_API_VERSIONS: readonly string[] = [] as const;

/**
 * API version type
 */
export type ApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

/**
 * Check if an API version is supported
 */
export function isSupportedApiVersion(version: string): version is ApiVersion {
	return SUPPORTED_API_VERSIONS.includes(version as ApiVersion);
}

/**
 * Check if an API version is deprecated
 */
export function isDeprecatedApiVersion(version: string): boolean {
	return DEPRECATED_API_VERSIONS.includes(version);
}

/**
 * Rate limit defaults
 */
export const RATE_LIMITS = {
	CHAT_CREATE: {
		LIMIT: 10,
		WINDOW_MS: 60_000, // 1 minute
	},
	MESSAGE_SEND: {
		LIMIT: 30,
		WINDOW_MS: 60_000, // 1 minute
	},
	API_GENERAL: {
		LIMIT: 100,
		WINDOW_MS: 60_000, // 1 minute
	},
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
	DEFAULT_LIMIT: 50,
	MAX_LIMIT: 100,
} as const;

/**
 * Session configuration
 */
export const SESSION = {
	COOKIE_PREFIX: "openchat",
	MAX_AGE: 60 * 60 * 24 * 7, // 7 days in seconds
} as const;

/**
 * Cache configuration
 */
export const CACHE = {
	MODELS_TTL: 60 * 60, // 1 hour in seconds
	USER_CONTEXT_TTL: 60 * 5, // 5 minutes in seconds
} as const;

/**
 * Application metadata
 */
export const APP_METADATA = {
	NAME: "OpenChat",
	DESCRIPTION: "Open source chat application",
	VERSION: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
} as const;
