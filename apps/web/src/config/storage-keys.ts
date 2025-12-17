/**
 * Centralized Storage Keys Configuration
 *
 * All localStorage and sessionStorage keys used throughout the application.
 * Using const assertions for type safety and autocomplete support.
 *
 * @example
 * ```ts
 * import { STORAGE_KEYS } from '@/config/storage-keys';
 * localStorage.setItem(STORAGE_KEYS.USER.LAST_MODEL, modelId);
 * ```
 */

/**
 * LocalStorage Keys
 * Persistent storage that survives browser sessions
 */
export const LOCAL_STORAGE_KEYS = {
	/** User preferences and settings */
	USER: {
		/** Last selected AI model ID */
		LAST_MODEL: "openchat:last-model",
		/** Jon Mode: Prevents AI from using em-dashes */
		JON_MODE: "openchat:jon-mode",
		/** Reasoning configuration (enabled, effort, max_tokens) */
		REASONING_CONFIG: "openchat:reasoning-config",
	},

	/** Session and authentication */
	SESSION: {
		/** Session token for Better Auth */
		TOKEN: "openchat:session-token",
	},

	/** Caching and performance */
	CACHE: {
		/** Cached list of available OpenRouter models */
		MODEL_LIST: "openchat:model-cache",
	},

	/** UI state and preferences */
	UI: {
		/** Sidebar collapsed state (1 = collapsed, 0 = expanded) */
		SIDEBAR_COLLAPSED: "oc:sb:collapsed",
		/** User's selected brand theme */
		BRAND_THEME: "openchat:brand-theme",
	},

	/** Feature flags and dismissals */
	FLAGS: {
		/** Dismissed auto-redirect notification */
		DISMISSED_REDIRECTS: "openchat:dismissed-auto-redirect",
		/** Sponsors box dismissed by user */
		SPONSORS_BOX_DISMISSED: "openchat:sponsors-box-dismissed",
	},
} as const;

/**
 * SessionStorage Keys
 * Temporary storage cleared when browser tab is closed
 */
export const SESSION_STORAGE_KEYS = {
	/** Temporary message state during navigation */
	PENDING_MESSAGE: "pendingMessage",
	/** Temporary model selection during navigation */
	PENDING_MODEL: "pendingModel",
} as const;

/**
 * Combined storage keys for backward compatibility
 * @deprecated Use LOCAL_STORAGE_KEYS or SESSION_STORAGE_KEYS directly
 */
export const STORAGE_KEYS = {
	...LOCAL_STORAGE_KEYS,
	SESSION: SESSION_STORAGE_KEYS,
} as const;

/**
 * Type-safe storage key paths
 * Extracts all possible string values from storage key objects
 */
export type LocalStorageKey = typeof LOCAL_STORAGE_KEYS[keyof typeof LOCAL_STORAGE_KEYS] extends infer T
	? T extends string
		? T
		: T extends Record<string, any>
			? T[keyof T]
			: never
	: never;

export type SessionStorageKey = typeof SESSION_STORAGE_KEYS[keyof typeof SESSION_STORAGE_KEYS];
