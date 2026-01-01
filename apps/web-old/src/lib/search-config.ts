/**
 * Web Search Configuration Types and Utilities
 *
 * Simple configuration for enabling/disabling web search functionality.
 */

/**
 * Web search configuration
 */
export type SearchConfig = {
	/** Enable or disable web search */
	enabled: boolean;
};

/**
 * Default search configuration (off by default)
 */
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
	enabled: false,
};

/**
 * Get display text for the search badge in UI
 *
 * @param config - SearchConfig to get badge text for
 * @returns Short display string ("ON" or "OFF")
 *
 * @example
 * ```typescript
 * getSearchBadgeText({ enabled: false }) // "OFF"
 * getSearchBadgeText({ enabled: true }) // "ON"
 * ```
 */
export function getSearchBadgeText(config: SearchConfig): string {
	return config.enabled ? "ON" : "OFF";
}
