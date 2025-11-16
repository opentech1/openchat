/**
 * Model Capability Detection Utilities
 *
 * Centralized detection for AI model capabilities to prevent divergence
 * between different parts of the application.
 *
 * SECURITY: This is critical for security because different capabilities
 * require different handling (e.g., reasoning models need special streaming).
 * Any divergence could lead to incorrect behavior or security issues.
 *
 * Based on AI SDK documentation and OpenRouter model capabilities.
 */

/**
 * Detect if a model supports extended reasoning capabilities.
 *
 * Reasoning models (also called "thinking" models) can show their internal
 * reasoning process. This requires special handling in the streaming pipeline.
 *
 * Models with reasoning:
 * - Anthropic: Claude 3.7 Sonnet, Claude 4 (Opus/Sonnet)
 * - OpenAI: GPT-5, o1, o3
 * - DeepSeek: R1, Reasoner
 * - Google: Gemini 2.5, Gemini 2.0 Flash Thinking
 * - Cohere: Command-A Reasoning
 * - Mistral: Magistral
 * - Qwen: Qwen3 Thinking variants
 *
 * @param modelId - Full model identifier (e.g., "anthropic/claude-sonnet-4.5")
 * @returns true if model supports reasoning capabilities
 *
 * @example
 * ```typescript
 * if (hasReasoningCapability("anthropic/claude-sonnet-4.5")) {
 *   // Enable reasoning display in UI
 *   // Configure special streaming parameters
 * }
 * ```
 */
export function hasReasoningCapability(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase();
	return (
		lowerModelId.includes("claude-3-7-sonnet") ||
		lowerModelId.includes("claude-opus-4") ||
		lowerModelId.includes("claude-sonnet-4") ||
		lowerModelId.includes("gpt-5") ||
		lowerModelId.includes("deepseek-r1") ||
		lowerModelId.includes("deepseek-reasoner") ||
		lowerModelId.includes("gemini-2.5") ||
		lowerModelId.includes("gemini-2.0-flash-thinking") ||
		lowerModelId.includes("/o1") ||
		lowerModelId.includes("/o3") ||
		lowerModelId.includes("magistral") ||
		lowerModelId.includes("command-a-reasoning") ||
		(lowerModelId.includes("qwen3") && lowerModelId.includes("thinking"))
	);
}

/**
 * Detect if a model supports image input (vision capabilities).
 *
 * Vision models can process and understand images alongside text.
 *
 * Models with image support:
 * - OpenAI: GPT-4 Vision, GPT-4 Turbo, GPT-4o, GPT-5
 * - Anthropic: Claude 3.x, Claude 4.x (Opus/Sonnet/Haiku)
 * - Google: All Gemini models
 * - Qwen: Qwen-VL, Qwen2-VL
 * - Mistral: Pixtral
 * - Open source: LLaVA, BakLLaVA
 *
 * @param modelId - Full model identifier
 * @returns true if model supports image input
 *
 * @example
 * ```typescript
 * if (hasImageCapability(modelId)) {
 *   // Show image upload option in UI
 *   // Enable image attachment processing
 * }
 * ```
 */
export function hasImageCapability(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase();
	return (
		// OpenAI Vision models
		lowerModelId.includes("gpt-4-vision") ||
		lowerModelId.includes("gpt-4-turbo") ||
		lowerModelId.includes("gpt-4o") ||
		lowerModelId.includes("gpt-5") ||
		// Claude models with vision
		lowerModelId.includes("claude-3") ||
		lowerModelId.includes("claude-4") ||
		// Google models with vision
		lowerModelId.includes("gemini") ||
		// Other vision models
		lowerModelId.includes("vision") ||
		lowerModelId.includes("llava") ||
		lowerModelId.includes("bakllava") ||
		// Anthropic's newer models
		lowerModelId.includes("claude-sonnet") ||
		lowerModelId.includes("claude-haiku") ||
		lowerModelId.includes("claude-opus") ||
		// Qwen VL models
		lowerModelId.includes("qwen-vl") ||
		lowerModelId.includes("qwen2-vl") ||
		// Mistral vision
		lowerModelId.includes("pixtral")
	);
}

/**
 * Detect if a model supports audio input.
 *
 * Audio-capable models can process voice recordings and other audio files.
 *
 * Models with audio support:
 * - Google: Gemini 2.0 Flash and later
 * - OpenAI: GPT-4o Audio
 * - Specialized: Whisper (transcription)
 *
 * @param modelId - Full model identifier
 * @returns true if model supports audio input
 *
 * @example
 * ```typescript
 * if (hasAudioCapability(modelId)) {
 *   // Show audio upload option
 *   // Enable voice message processing
 * }
 * ```
 */
export function hasAudioCapability(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase();
	return (
		// Gemini 2.0 Flash and later support audio
		(lowerModelId.includes("gemini-2") && lowerModelId.includes("flash")) ||
		// GPT-4 with audio/whisper
		lowerModelId.includes("gpt-4o-audio") ||
		// Specific audio models
		lowerModelId.includes("whisper") ||
		lowerModelId.includes("audio")
	);
}

/**
 * Detect if a model supports video input.
 *
 * Video-capable models can analyze video content frame by frame.
 *
 * Models with video support:
 * - Google: Gemini 2.0 Flash
 * - (Other models may be added as they become available)
 *
 * @param modelId - Full model identifier
 * @returns true if model supports video input
 *
 * @example
 * ```typescript
 * if (hasVideoCapability(modelId)) {
 *   // Show video upload option
 *   // Enable video analysis features
 * }
 * ```
 */
export function hasVideoCapability(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase();
	return (
		// Gemini 2.0 Flash supports video
		(lowerModelId.includes("gemini-2") && lowerModelId.includes("flash")) ||
		// Specific video models
		lowerModelId.includes("video")
	);
}

/**
 * Get all capabilities for a model as an object.
 *
 * This is useful for UI rendering and feature enablement.
 *
 * @param modelId - Full model identifier
 * @returns Object with boolean flags for each capability
 *
 * @example
 * ```typescript
 * const capabilities = getModelCapabilities("anthropic/claude-sonnet-4.5");
 * // { reasoning: true, image: true, audio: false, video: false }
 *
 * if (capabilities.reasoning) {
 *   // Show reasoning toggle in UI
 * }
 * ```
 */
export function getModelCapabilities(modelId: string): {
	reasoning: boolean;
	image: boolean;
	audio: boolean;
	video: boolean;
} {
	return {
		reasoning: hasReasoningCapability(modelId),
		image: hasImageCapability(modelId),
		audio: hasAudioCapability(modelId),
		video: hasVideoCapability(modelId),
	};
}

/**
 * Type for model capability flags
 */
export type ModelCapabilities = ReturnType<typeof getModelCapabilities>;
