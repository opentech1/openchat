/**
 * Chat API configuration constants and environment parsing
 *
 * This module centralizes all configuration values for the chat handler,
 * including rate limiting, message limits, stream buffering, and security settings.
 */

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse a positive number from an environment variable with a default fallback.
 * Returns the default if the value is not a finite positive number.
 */
function parsePositiveNumber(value: string | undefined, defaultValue: number): number {
	const parsed = Number(value ?? defaultValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

/**
 * Parse a number with an optional maximum cap.
 * Returns the parsed value capped at the maximum, or the default if invalid.
 */
function parseNumberWithCap(
	value: string | undefined,
	defaultValue: number,
	maxValue: number
): number {
	if (!value || value.trim() === "") return defaultValue;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
	return Math.min(parsed, maxValue);
}

/**
 * Parse a nullable number that can be explicitly set to null via "null" string.
 * Returns null if the value is "null", the parsed number, or the default.
 */
function parseNullableNumber(
	value: string | undefined,
	defaultValue: number | null
): number | null {
	if (value === undefined || value === null || value.trim() === "") {
		return defaultValue;
	}
	if (value.trim().toLowerCase() === "null") {
		return null;
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return defaultValue;
	}
	return parsed < 0 ? 0 : parsed;
}

// =============================================================================
// Rate Limiting Configuration
// =============================================================================

/** Default maximum requests per minute if not configured via env */
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;

/** Rate limit window duration in milliseconds (1 minute) */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Default maximum number of rate limit buckets to track in memory */
export const DEFAULT_MAX_TRACKED_BUCKETS = 1_000;

/** Configured rate limit from environment */
export const DEFAULT_RATE_LIMIT = parsePositiveNumber(
	process.env.OPENROUTER_RATE_LIMIT_PER_MIN,
	DEFAULT_RATE_LIMIT_PER_MINUTE
);

/** Maximum tracked rate limit buckets, null if no limit should be enforced */
const RAW_MAX_TRACKED_RATE_BUCKETS = parsePositiveNumber(
	process.env.OPENROUTER_RATE_LIMIT_TRACKED_BUCKETS,
	DEFAULT_MAX_TRACKED_BUCKETS
);
export const MAX_TRACKED_RATE_BUCKETS: number | null =
	Number.isFinite(RAW_MAX_TRACKED_RATE_BUCKETS) && RAW_MAX_TRACKED_RATE_BUCKETS > 0
		? RAW_MAX_TRACKED_RATE_BUCKETS
		: null;

// =============================================================================
// Message Content Configuration
// =============================================================================

/** Default maximum characters allowed in user message parts before truncation */
export const DEFAULT_MAX_USER_CHARS = 8_000;

/** Configured maximum user part characters from environment */
export const MAX_USER_PART_CHARS = parsePositiveNumber(
	process.env.OPENROUTER_MAX_USER_CHARS,
	DEFAULT_MAX_USER_CHARS
);

// =============================================================================
// Request Size Limits (Security)
// =============================================================================

/** Maximum number of messages allowed per request */
export const MAX_MESSAGES_PER_REQUEST = parsePositiveNumber(
	process.env.MAX_MESSAGES_PER_REQUEST,
	100
);

/** Maximum request body size in bytes (default: 10MB) */
export const MAX_REQUEST_BODY_SIZE = parsePositiveNumber(
	process.env.MAX_REQUEST_BODY_SIZE,
	10_000_000
);

/** Maximum attachment size in bytes (default: 5MB) */
export const MAX_ATTACHMENT_SIZE = parsePositiveNumber(
	process.env.MAX_ATTACHMENT_SIZE,
	5_000_000
);

/** Maximum number of attachments per message (default: 10) */
export const MAX_ATTACHMENTS = parsePositiveNumber(
	process.env.MAX_ATTACHMENTS,
	10
);

/** Maximum total attachment size per request in bytes (default: 20MB) */
export const MAX_TOTAL_ATTACHMENT_SIZE = parsePositiveNumber(
	process.env.MAX_TOTAL_ATTACHMENT_SIZE,
	20_000_000
);

/** Maximum message content length in characters (default: 50k) */
export const MAX_MESSAGE_CONTENT_LENGTH = parsePositiveNumber(
	process.env.MAX_MESSAGE_CONTENT_LENGTH,
	50_000
);

// =============================================================================
// Stream Buffering Configuration
// =============================================================================
// PERFORMANCE: Increased intervals to reduce DB write frequency during streaming
// Previously: 80ms/24chars = ~12 writes/sec, Now: 300ms/80chars = ~3 writes/sec

/** Default interval for flushing buffered stream chunks to database (milliseconds) */
export const DEFAULT_STREAM_FLUSH_INTERVAL_MS = 300;

/** Default minimum characters required before flushing a stream chunk */
export const DEFAULT_STREAM_MIN_CHARS_PER_FLUSH = 80;

/** Default delay between smooth stream word chunks (milliseconds) */
export const DEFAULT_STREAM_SMOOTH_DELAY_MS = 10;

/** Configured stream flush interval from environment */
export const STREAM_FLUSH_INTERVAL_MS = parsePositiveNumber(
	process.env.OPENROUTER_STREAM_FLUSH_INTERVAL_MS,
	DEFAULT_STREAM_FLUSH_INTERVAL_MS
);

/** Configured minimum characters per flush from environment */
export const STREAM_MIN_CHARS_PER_FLUSH = parsePositiveNumber(
	process.env.OPENROUTER_STREAM_MIN_CHARS_PER_FLUSH,
	DEFAULT_STREAM_MIN_CHARS_PER_FLUSH
);

/** Configured smooth stream delay from environment (null disables smoothing) */
export const STREAM_SMOOTH_DELAY_MS = parseNullableNumber(
	process.env.OPENROUTER_STREAM_DELAY_MS,
	DEFAULT_STREAM_SMOOTH_DELAY_MS
);

// =============================================================================
// Token Limits
// =============================================================================

/** Default maximum output tokens */
export const DEFAULT_MAX_TOKENS = 8192;

/** Maximum cap for output tokens to prevent excessive usage */
export const MAX_TOKENS_CAP = 32768;

/** Configured maximum tokens from environment (capped at MAX_TOKENS_CAP) */
export const MAX_TOKENS = parseNumberWithCap(
	process.env.OPENROUTER_MAX_TOKENS,
	DEFAULT_MAX_TOKENS,
	MAX_TOKENS_CAP
);

// =============================================================================
// Timeout Configuration
// =============================================================================

/** Default OpenRouter stream timeout in milliseconds (2 minutes) */
export const DEFAULT_OPENROUTER_TIMEOUT_MS = 120_000;

/** Maximum allowed timeout in milliseconds (5 minutes) */
export const MAX_OPENROUTER_TIMEOUT_MS = 300_000;

/** Configured OpenRouter timeout from environment (capped at MAX_OPENROUTER_TIMEOUT_MS) */
export const OPENROUTER_TIMEOUT_MS = parseNumberWithCap(
	process.env.OPENROUTER_TIMEOUT_MS,
	DEFAULT_OPENROUTER_TIMEOUT_MS,
	MAX_OPENROUTER_TIMEOUT_MS
);

// =============================================================================
// HTTP Headers
// =============================================================================

/** Header name for forwarded IP addresses */
export const FORWARDED_FOR_HEADER = "x-forwarded-for";

/** Default IP address when none can be determined */
export const DEFAULT_IP = "127.0.0.1";

// =============================================================================
// External Service URLs
// =============================================================================

/** OpenRouter API base URL */
export const OPENROUTER_BASE_URL =
	process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
