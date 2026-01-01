/**
 * Reasoning Configuration Types and Utilities
 *
 * Based on OpenRouter reasoning tokens API specification:
 * https://openrouter.ai/docs/use-cases/reasoning-tokens
 *
 * Different models support different reasoning parameters:
 * - OpenAI (o1, o3, GPT-5): reasoning.effort ("low", "medium", "high")
 * - Anthropic (Claude 3.7, 4.x): reasoning.max_tokens (1024-32000)
 * - Gemini: reasoning.max_tokens
 * - Grok: reasoning.effort
 */

import { hasMandatoryReasoning } from "./model-capabilities";

/**
 * Reasoning effort level for OpenAI-style models
 * - low: ~25% of max_tokens for reasoning (quick)
 * - medium: ~50% of max_tokens for reasoning (balanced)
 * - high: ~80% of max_tokens for reasoning (thorough)
 */
export type ReasoningEffort = "low" | "medium" | "high";

/**
 * Preset reasoning levels for unified UI
 * - none: Reasoning disabled
 * - low: Quick reasoning (~4K tokens)
 * - medium: Balanced reasoning (~8K tokens)
 * - high: Thorough reasoning (~16K tokens)
 */
export type ReasoningLevel = "none" | "low" | "medium" | "high";

/**
 * Reasoning configuration that can be sent to OpenRouter API
 */
export type ReasoningConfig = {
	/** Enable or disable reasoning */
	enabled: boolean;
	/** Effort level for OpenAI-style models */
	effort?: ReasoningEffort;
	/** Max tokens for Anthropic/Gemini-style models */
	max_tokens?: number;
	/** Exclude reasoning from response (internal use only) */
	exclude?: boolean;
};

/**
 * Extended reasoning configuration with UI state
 * Used for tracking whether user is in advanced (custom token) mode
 */
export interface ReasoningConfigExtended extends ReasoningConfig {
	/** True when using custom token count instead of preset levels */
	advancedMode?: boolean;
	/** Preset level when not in advanced mode */
	level?: ReasoningLevel;
}

/**
 * Default reasoning configuration (off by default)
 */
export const DEFAULT_REASONING_CONFIG: ReasoningConfig = {
	enabled: false,
};

/**
 * Token amounts for each preset reasoning level
 * Used when converting levels to max_tokens for Anthropic/Gemini models
 */
export const REASONING_PRESETS = {
	none: 0,
	low: 4096,
	medium: 8192,
	high: 16384,
} as const;

/**
 * Get the model provider from model ID
 */
function getModelProvider(modelId: string): string | null {
	const parts = modelId.split("/");
	return parts.length > 1 ? parts[0]! : null;
}

/**
 * Check if a model supports effort-based reasoning (OpenAI, Grok)
 */
export function supportsReasoningEffort(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase();
	return (
		lowerModelId.includes("gpt-5") ||
		lowerModelId.includes("/o1") ||
		lowerModelId.includes("/o3") ||
		lowerModelId.includes("o1-pro") ||
		lowerModelId.includes("o1-mini") ||
		lowerModelId.includes("o3-mini") ||
		lowerModelId.includes("grok")
	);
}

/**
 * Check if a model supports max_tokens-based reasoning (Anthropic, Gemini, Qwen)
 */
export function supportsReasoningMaxTokens(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase();
	return (
		lowerModelId.includes("claude-3-7-sonnet") ||
		lowerModelId.includes("claude-opus-4") ||
		lowerModelId.includes("claude-sonnet-4") ||
		lowerModelId.includes("gemini-2.5") ||
		lowerModelId.includes("gemini-2.0-flash-thinking") ||
		(lowerModelId.includes("qwen3") && lowerModelId.includes("thinking"))
	);
}

/**
 * Get the default reasoning configuration for a specific model
 * Based on model capabilities and OpenRouter best practices
 *
 * IMPORTANT: Mandatory reasoning models (GPT-5, O1, O3, Grok) are enabled by default
 * because they cannot have reasoning disabled via API.
 */
export function getDefaultReasoningForModel(modelId: string): ReasoningConfig {
	// Check if this is a mandatory reasoning model
	const isMandatory = hasMandatoryReasoning(modelId);

	if (supportsReasoningEffort(modelId)) {
		return {
			enabled: isMandatory, // Auto-enable for mandatory models
			effort: "medium",
		};
	}

	if (supportsReasoningMaxTokens(modelId)) {
		return {
			enabled: isMandatory, // Auto-enable for mandatory models
			max_tokens: 4000,
		};
	}

	// Fallback for other reasoning models
	return {
		enabled: false,
		effort: "medium",
	};
}

/**
 * Convert reasoning config to OpenRouter API format
 * Returns the object to be sent in the request body
 */
export function toOpenRouterReasoningParam(
	config: ReasoningConfig
): Record<string, unknown> | undefined {
	if (!config.enabled) {
		return undefined;
	}

	const reasoning: Record<string, unknown> = {};

	if (config.effort !== undefined) {
		reasoning.effort = config.effort;
	}

	if (config.max_tokens !== undefined) {
		reasoning.max_tokens = config.max_tokens;
	}

	if (config.exclude !== undefined) {
		reasoning.exclude = config.exclude;
	}

	// If enabled but no specific config, just enable with defaults
	if (Object.keys(reasoning).length === 0) {
		reasoning.enabled = true;
	}

	return reasoning;
}

/**
 * Get reasoning level display label
 */
export function getReasoningLevelLabel(config: ReasoningConfig): string {
	if (!config.enabled) return "Off";

	if (config.effort) {
		return config.effort.charAt(0).toUpperCase() + config.effort.slice(1);
	}

	if (config.max_tokens) {
		return `${config.max_tokens} tokens`;
	}

	return "On";
}

/**
 * Validate reasoning max_tokens value for Anthropic models
 * Returns clamped value between 1024 and 32000
 */
export function clampAnthropicReasoningTokens(tokens: number): number {
	return Math.max(1024, Math.min(32000, tokens));
}

/**
 * Convert a preset reasoning level to a ReasoningConfig
 *
 * Uses effort for models that support it (OpenAI, Grok),
 * otherwise uses max_tokens (Anthropic, Gemini).
 *
 * @param level - Preset reasoning level
 * @param modelId - Model identifier to determine config type
 * @returns ReasoningConfig appropriate for the model
 *
 * @example
 * ```typescript
 * const config = levelToReasoningConfig("high", "anthropic/claude-sonnet-4");
 * // { enabled: true, max_tokens: 16384 }
 *
 * const config2 = levelToReasoningConfig("high", "x-ai/grok-2");
 * // { enabled: true, effort: "high" }
 * ```
 */
export function levelToReasoningConfig(
	level: ReasoningLevel,
	modelId: string
): ReasoningConfig {
	// Validate level input
	const validLevels: ReasoningLevel[] = ["none", "low", "medium", "high"];
	if (!validLevels.includes(level)) {
		console.warn(`Invalid reasoning level: ${level}, defaulting to "medium"`);
		level = "medium";
	}

	if (level === "none") {
		return { enabled: false };
	}

	// Use effort for models that support it, otherwise use max_tokens
	// Cast level to ReasoningEffort since we already checked level !== "none"
	if (supportsReasoningEffort(modelId)) {
		return { enabled: true, effort: level as ReasoningEffort };
	}

	return { enabled: true, max_tokens: REASONING_PRESETS[level] };
}

/**
 * Convert a ReasoningConfig back to a preset level for UI display
 *
 * Maps effort values directly to levels. For max_tokens,
 * finds the closest preset level.
 *
 * @param config - ReasoningConfig to convert
 * @returns Closest matching ReasoningLevel
 *
 * @example
 * ```typescript
 * reasoningConfigToLevel({ enabled: false }) // "none"
 * reasoningConfigToLevel({ enabled: true, effort: "high" }) // "high"
 * reasoningConfigToLevel({ enabled: true, max_tokens: 10000 }) // "medium"
 * ```
 */
export function reasoningConfigToLevel(config: ReasoningConfig): ReasoningLevel {
	if (!config.enabled) return "none";

	// If using effort, map directly
	if (config.effort) {
		if (config.effort === "low") return "low";
		if (config.effort === "medium") return "medium";
		if (config.effort === "high") return "high";
	}

	// If using max_tokens, use midpoint boundaries for better UX
	if (config.max_tokens) {
		const lowMedBoundary =
			(REASONING_PRESETS.low + REASONING_PRESETS.medium) / 2; // 6144
		const medHighBoundary =
			(REASONING_PRESETS.medium + REASONING_PRESETS.high) / 2; // 12288

		if (config.max_tokens <= lowMedBoundary) return "low";
		if (config.max_tokens <= medHighBoundary) return "medium";
		return "high";
	}

	return "medium"; // default
}

/**
 * Get display text for the reasoning badge in UI
 *
 * Shows preset level name for standard configs, or token count
 * for custom (advanced mode) configs.
 *
 * @param config - ReasoningConfig to get badge text for
 * @returns Short display string (e.g., "NONE", "LOW", "MED", "HIGH", "8K")
 *
 * @example
 * ```typescript
 * getReasoningBadgeText({ enabled: false }) // "NONE"
 * getReasoningBadgeText({ enabled: true, effort: "medium" }) // "MED"
 * getReasoningBadgeText({ enabled: true, max_tokens: 8192 }) // "MED" (preset value)
 * getReasoningBadgeText({ enabled: true, max_tokens: 8000 }) // "8K" (custom value)
 * getReasoningBadgeText({ enabled: true, max_tokens: 500 }) // "500"
 * ```
 */
export function getReasoningBadgeText(config: ReasoningConfig): string {
	if (!config.enabled) return "NONE";

	// If using effort, show level
	if (config.effort) {
		const level = reasoningConfigToLevel(config);
		return level === "medium" ? "MED" : level.toUpperCase();
	}

	// If using max_tokens, check if it's a preset or custom
	if (config.max_tokens) {
		const presetValues: readonly number[] = Object.values(REASONING_PRESETS);
		const isPreset = presetValues.includes(config.max_tokens);

		if (isPreset) {
			// Show level name for preset values
			const level = reasoningConfigToLevel(config);
			return level === "medium" ? "MED" : level.toUpperCase();
		}

		// Custom value - show token count
		if (config.max_tokens >= 1000) {
			return `${Math.round(config.max_tokens / 1000)}K`;
		}
		return config.max_tokens.toString();
	}

	return "ON"; // Fallback for enabled but no specific config
}
