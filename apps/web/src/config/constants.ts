/**
 * Centralized Constants Configuration
 *
 * All magic numbers and configuration values for the web application.
 * Values can be overridden via environment variables where applicable.
 *
 * @example
 * ```ts
 * import { RATE_LIMITS, STREAM_CONFIG } from '@/config/constants';
 * if (requestCount > RATE_LIMITS.DEFAULT_PER_MINUTE) { ... }
 * ```
 */

/**
 * Rate Limiting Configuration
 * Controls request throttling to prevent abuse
 */
export const RATE_LIMITS = {
	/** Default maximum requests per minute if not configured via env */
	DEFAULT_PER_MINUTE: 30,

	/** Rate limit window duration in milliseconds (1 minute) */
	WINDOW_MS: 60_000,

	/** Default maximum number of rate limit buckets to track in memory */
	DEFAULT_MAX_TRACKED_BUCKETS: 1_000,
} as const;

/**
 * Message Content Configuration
 * Limits for message and content sizes
 */
export const MESSAGE_LIMITS = {
	/** Maximum characters allowed in user message parts before truncation */
	DEFAULT_MAX_USER_CHARS: 8_000,

	/** Maximum messages allowed per request */
	MAX_PER_REQUEST: 100,

	/** Maximum total content length for a single message (characters) */
	MAX_CONTENT_LENGTH: 50_000,

	/** UI-side message throttle for rendering performance (milliseconds) */
	THROTTLE_MS: 80,
} as const;

/**
 * Stream Buffering Configuration
 * Controls how streaming responses are buffered and flushed to database
 *
 * PERFORMANCE: Increased intervals to reduce DB write frequency during streaming.
 * Previously: 80ms flush with 24 chars min = ~12 DB writes/second
 * Now: 300ms flush with 80 chars min = ~3 DB writes/second
 * This significantly reduces latency while maintaining smooth UX.
 */
export const STREAM_CONFIG = {
	/** Default interval for flushing buffered stream chunks to database (milliseconds) */
	DEFAULT_FLUSH_INTERVAL_MS: 300,

	/** Default minimum characters required before flushing a stream chunk */
	DEFAULT_MIN_CHARS_PER_FLUSH: 80,

	/** Default delay between smooth stream word chunks (milliseconds) */
	DEFAULT_SMOOTH_DELAY_MS: 10,
} as const;

/**
 * Request Size Limits
 * Security limits to prevent DoS attacks
 */
export const REQUEST_LIMITS = {
	/** Maximum total request body size in bytes (10MB) */
	MAX_BODY_SIZE: 10_000_000,

	/** Maximum attachment size in bytes (5MB) */
	MAX_ATTACHMENT_SIZE: 5_000_000,
} as const;

/**
 * OpenRouter Configuration
 * Settings for OpenRouter API integration
 */
export const OPENROUTER_CONFIG = {
	/** Timeout for OpenRouter stream to prevent hanging requests (milliseconds) */
	DEFAULT_TIMEOUT_MS: 120_000, // 2 minutes

	/** Maximum timeout allowed (milliseconds) */
	MAX_TIMEOUT_MS: 300_000, // 5 minutes

	/** Default maximum output tokens */
	DEFAULT_MAX_TOKENS: 8192,

	/** Maximum allowed output tokens */
	MAX_TOKENS_LIMIT: 32_768, // 32k cap to prevent excessive token usage
} as const;

/**
 * Reasoning Model Configuration
 * Settings for models with extended thinking capabilities
 */
export const REASONING_CONFIG = {
	/** Budget tokens for Anthropic thinking feature */
	ANTHROPIC_THINKING_BUDGET: 12_000,

	/** Token budget for Cohere reasoning */
	COHERE_REASONING_BUDGET: 8_000,
} as const;

/**
 * UI Configuration
 * Visual and interaction settings
 */
export const UI_CONFIG = {
	/** Default composer height in pixels */
	DEFAULT_COMPOSER_HEIGHT: 320,

	/** Minimum conversation padding bottom in pixels */
	MIN_CONVERSATION_PADDING: 220,

	/** Additional padding for composer in pixels */
	COMPOSER_PADDING: 48,
} as const;

/**
 * Cache Configuration
 * Settings for client-side caching
 */
export const CACHE_CONFIG = {
	/** Debounce delay for chat prefetch updates (milliseconds) */
	PREFETCH_DEBOUNCE_MS: 500,
} as const;

/**
 * Helper function to get environment-configurable rate limit
 * @returns Configured rate limit or default
 */
export function getRateLimit(): number {
	if (typeof process === "undefined") return RATE_LIMITS.DEFAULT_PER_MINUTE;
	const envValue = process.env.OPENROUTER_RATE_LIMIT_PER_MIN;
	if (!envValue) return RATE_LIMITS.DEFAULT_PER_MINUTE;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : RATE_LIMITS.DEFAULT_PER_MINUTE;
}

/**
 * Helper function to get environment-configurable max tracked buckets
 * @returns Configured max buckets or null if unlimited
 */
export function getMaxTrackedBuckets(): number | null {
	if (typeof process === "undefined") return RATE_LIMITS.DEFAULT_MAX_TRACKED_BUCKETS;
	const envValue = process.env.OPENROUTER_RATE_LIMIT_TRACKED_BUCKETS;
	if (!envValue) return RATE_LIMITS.DEFAULT_MAX_TRACKED_BUCKETS;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Helper function to get environment-configurable max user chars
 * @returns Configured max user chars or default
 */
export function getMaxUserChars(): number {
	if (typeof process === "undefined") return MESSAGE_LIMITS.DEFAULT_MAX_USER_CHARS;
	const envValue = process.env.OPENROUTER_MAX_USER_CHARS;
	if (!envValue) return MESSAGE_LIMITS.DEFAULT_MAX_USER_CHARS;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : MESSAGE_LIMITS.DEFAULT_MAX_USER_CHARS;
}

/**
 * Helper function to get environment-configurable stream flush interval
 * @returns Configured flush interval or default
 */
export function getStreamFlushInterval(): number {
	if (typeof process === "undefined") return STREAM_CONFIG.DEFAULT_FLUSH_INTERVAL_MS;
	const envValue = process.env.OPENROUTER_STREAM_FLUSH_INTERVAL_MS;
	if (!envValue) return STREAM_CONFIG.DEFAULT_FLUSH_INTERVAL_MS;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : STREAM_CONFIG.DEFAULT_FLUSH_INTERVAL_MS;
}

/**
 * Helper function to get environment-configurable min chars per flush
 * @returns Configured min chars or default
 */
export function getStreamMinCharsPerFlush(): number {
	if (typeof process === "undefined") return STREAM_CONFIG.DEFAULT_MIN_CHARS_PER_FLUSH;
	const envValue = process.env.OPENROUTER_STREAM_MIN_CHARS_PER_FLUSH;
	if (!envValue) return STREAM_CONFIG.DEFAULT_MIN_CHARS_PER_FLUSH;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : STREAM_CONFIG.DEFAULT_MIN_CHARS_PER_FLUSH;
}

/**
 * Helper function to get environment-configurable smooth delay
 * @returns Configured delay or null to disable smoothing
 */
export function getStreamSmoothDelay(): number | null {
	if (typeof process === "undefined") return STREAM_CONFIG.DEFAULT_SMOOTH_DELAY_MS;
	const envValue = process.env.OPENROUTER_STREAM_DELAY_MS;
	if (!envValue || envValue.trim() === "") return STREAM_CONFIG.DEFAULT_SMOOTH_DELAY_MS;
	if (envValue.trim().toLowerCase() === "null") return null;
	const parsed = Number(envValue);
	if (!Number.isFinite(parsed)) return STREAM_CONFIG.DEFAULT_SMOOTH_DELAY_MS;
	return parsed < 0 ? 0 : parsed;
}

/**
 * Helper function to get environment-configurable max tokens
 * @returns Configured max tokens capped at limit
 */
export function getMaxTokens(): number {
	if (typeof process === "undefined") return OPENROUTER_CONFIG.DEFAULT_MAX_TOKENS;
	const envValue = process.env.OPENROUTER_MAX_TOKENS;
	if (!envValue || envValue.trim() === "") return OPENROUTER_CONFIG.DEFAULT_MAX_TOKENS;
	const parsed = Number(envValue);
	if (!Number.isFinite(parsed) || parsed <= 0) return OPENROUTER_CONFIG.DEFAULT_MAX_TOKENS;
	return Math.min(parsed, OPENROUTER_CONFIG.MAX_TOKENS_LIMIT);
}

/**
 * Helper function to get environment-configurable timeout
 * @returns Configured timeout capped at maximum
 */
export function getOpenRouterTimeout(): number {
	if (typeof process === "undefined") return OPENROUTER_CONFIG.DEFAULT_TIMEOUT_MS;
	const envValue = process.env.OPENROUTER_TIMEOUT_MS;
	if (!envValue || envValue.trim() === "") return OPENROUTER_CONFIG.DEFAULT_TIMEOUT_MS;
	const parsed = Number(envValue);
	if (!Number.isFinite(parsed) || parsed <= 0) return OPENROUTER_CONFIG.DEFAULT_TIMEOUT_MS;
	return Math.min(parsed, OPENROUTER_CONFIG.MAX_TIMEOUT_MS);
}

/**
 * Helper function to get environment-configurable max messages per request
 * @returns Configured max messages or default
 */
export function getMaxMessagesPerRequest(): number {
	if (typeof process === "undefined") return MESSAGE_LIMITS.MAX_PER_REQUEST;
	const envValue = process.env.MAX_MESSAGES_PER_REQUEST;
	if (!envValue) return MESSAGE_LIMITS.MAX_PER_REQUEST;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : MESSAGE_LIMITS.MAX_PER_REQUEST;
}

/**
 * Helper function to get environment-configurable max request body size
 * @returns Configured max size or default
 */
export function getMaxRequestBodySize(): number {
	if (typeof process === "undefined") return REQUEST_LIMITS.MAX_BODY_SIZE;
	const envValue = process.env.MAX_REQUEST_BODY_SIZE;
	if (!envValue) return REQUEST_LIMITS.MAX_BODY_SIZE;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : REQUEST_LIMITS.MAX_BODY_SIZE;
}

/**
 * Helper function to get environment-configurable max attachment size
 * @returns Configured max size or default
 */
export function getMaxAttachmentSize(): number {
	if (typeof process === "undefined") return REQUEST_LIMITS.MAX_ATTACHMENT_SIZE;
	const envValue = process.env.MAX_ATTACHMENT_SIZE;
	if (!envValue) return REQUEST_LIMITS.MAX_ATTACHMENT_SIZE;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : REQUEST_LIMITS.MAX_ATTACHMENT_SIZE;
}

/**
 * Helper function to get environment-configurable max message content length
 * @returns Configured max length or default
 */
export function getMaxMessageContentLength(): number {
	if (typeof process === "undefined") return MESSAGE_LIMITS.MAX_CONTENT_LENGTH;
	const envValue = process.env.MAX_MESSAGE_CONTENT_LENGTH;
	if (!envValue) return MESSAGE_LIMITS.MAX_CONTENT_LENGTH;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : MESSAGE_LIMITS.MAX_CONTENT_LENGTH;
}

/**
 * Helper function to get UI message throttle from environment
 * @returns Configured throttle or default
 */
export function getMessageThrottle(): number {
	if (typeof process === "undefined") return MESSAGE_LIMITS.THROTTLE_MS;
	const envValue = process.env.NEXT_PUBLIC_CHAT_THROTTLE_MS;
	if (!envValue) return MESSAGE_LIMITS.THROTTLE_MS;
	const parsed = Number(envValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : MESSAGE_LIMITS.THROTTLE_MS;
}
