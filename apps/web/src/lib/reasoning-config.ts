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
 * - medium: ~50% of max_tokens for reasoning (balanced)
 * - high: ~80% of max_tokens for reasoning (thorough)
 */
export type ReasoningEffort = "medium" | "high";

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
 * Default reasoning configuration (off by default)
 */
export const DEFAULT_REASONING_CONFIG: ReasoningConfig = {
	enabled: false,
};

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
