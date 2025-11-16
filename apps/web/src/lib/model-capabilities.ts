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
 * - Qwen: Qwen3 Thinking variants, QwQ
 * - OpenRouter: Polaris Alpha
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
		lowerModelId.includes("o1-pro") ||
		lowerModelId.includes("o1-mini") ||
		lowerModelId.includes("o3-mini") ||
		lowerModelId.includes("magistral") ||
		lowerModelId.includes("command-a-reasoning") ||
		lowerModelId.includes("polaris-alpha") ||
		lowerModelId.includes("qwq") ||
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
 * - Qwen: Qwen-VL, Qwen2-VL, Qwen3-VL
 * - Mistral: Pixtral
 * - Meta: Llama 3.2 Vision, Llama 4
 * - Open source: LLaVA, BakLLaVA, MiniCPM, Moondream, Yi-VL, InternVL, CogVLM
 * - xAI: Grok Vision
 * - Cohere: Command R+ Vision
 * - DeepSeek: V3 and later
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
		lowerModelId.includes("chatgpt-4o") ||
		// Claude models with vision (all Claude 3+ support vision)
		lowerModelId.includes("claude-3") ||
		lowerModelId.includes("claude-4") ||
		lowerModelId.includes("claude-sonnet") ||
		lowerModelId.includes("claude-haiku") ||
		lowerModelId.includes("claude-opus") ||
		// Google models with vision (all Gemini models)
		lowerModelId.includes("gemini") ||
		// xAI Grok models
		lowerModelId.includes("grok") ||
		// Meta Llama vision models
		lowerModelId.includes("llama-3.2") ||
		lowerModelId.includes("llama-4") ||
		lowerModelId.includes("llama-vision") ||
		// Qwen VL models
		lowerModelId.includes("qwen-vl") ||
		lowerModelId.includes("qwen2-vl") ||
		lowerModelId.includes("qwen3-vl") ||
		lowerModelId.includes("qwq-vl") ||
		// Mistral vision
		lowerModelId.includes("pixtral") ||
		// DeepSeek vision models
		lowerModelId.includes("deepseek-v3") ||
		lowerModelId.includes("deepseek-vision") ||
		// Cohere vision
		lowerModelId.includes("command-r") && lowerModelId.includes("vision") ||
		// Generic vision indicator
		lowerModelId.includes("vision") ||
		// Open source vision models
		lowerModelId.includes("llava") ||
		lowerModelId.includes("bakllava") ||
		lowerModelId.includes("minicpm") ||
		lowerModelId.includes("moondream") ||
		lowerModelId.includes("yi-vl") ||
		lowerModelId.includes("internvl") ||
		lowerModelId.includes("cogvlm") ||
		lowerModelId.includes("phi-3.5-vision") ||
		lowerModelId.includes("phi-4-vision")
	);
}

/**
 * Detect if a model supports audio input.
 *
 * Audio-capable models can process voice recordings and other audio files.
 *
 * Models with audio support:
 * - Google: Gemini 2.0 Flash and later, Gemini 2.5
 * - OpenAI: GPT-4o Audio, GPT-5
 * - Specialized: Whisper (transcription)
 * - Qwen: Qwen Audio, Qwen2-Audio
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
		(lowerModelId.includes("gemini-2") && (lowerModelId.includes("flash") || lowerModelId.includes("pro"))) ||
		lowerModelId.includes("gemini-2.5") ||
		// GPT-4 with audio/whisper
		lowerModelId.includes("gpt-4o-audio") ||
		lowerModelId.includes("gpt-5") ||
		// Qwen audio models
		lowerModelId.includes("qwen-audio") ||
		lowerModelId.includes("qwen2-audio") ||
		// Specific audio models
		lowerModelId.includes("whisper") ||
		// Generic audio indicator (but not just the word "audio" alone)
		(lowerModelId.includes("audio") && !lowerModelId.endsWith("audio"))
	);
}

/**
 * Detect if a model supports video input.
 *
 * Video-capable models can analyze video content frame by frame.
 *
 * Models with video support:
 * - Google: Gemini 2.0 Flash, Gemini 2.5
 * - OpenAI: GPT-5
 * - Qwen: Qwen2-VL (supports video)
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
		// Gemini 2.0 Flash and later support video
		(lowerModelId.includes("gemini-2") && (lowerModelId.includes("flash") || lowerModelId.includes("pro"))) ||
		lowerModelId.includes("gemini-2.5") ||
		// GPT-5 supports video
		lowerModelId.includes("gpt-5") ||
		// Qwen VL models (Qwen2-VL supports video)
		lowerModelId.includes("qwen2-vl") ||
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
