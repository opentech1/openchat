import { getEncoding, Tiktoken, type TiktokenEncoding } from "js-tiktoken";
import type { UIMessage } from "ai";

/**
 * Token counter utility for estimating context usage
 */

// Cache encoders to avoid recreating them
const encoderCache: Map<TiktokenEncoding, Tiktoken> = new Map();

/**
 * Get or create an encoder for a specific encoding name
 */
function getEncoder(encodingName: TiktokenEncoding): Tiktoken {
  if (!encoderCache.has(encodingName)) {
    const encoder = getEncoding(encodingName);
    encoderCache.set(encodingName, encoder);
  }
  return encoderCache.get(encodingName)!;
}

/**
 * Determine the appropriate encoding based on model name
 * @param modelId - The model identifier (e.g., "gpt-4", "claude-3-opus")
 * @returns The encoding name to use
 */
export function getEncodingForModel(modelId: string | undefined): TiktokenEncoding {
  if (!modelId) {
    return "cl100k_base"; // default
  }

  const lowerModel = modelId.toLowerCase();

  // o200k_base for GPT-4o and newer models
  if (lowerModel.includes("gpt-4o") || lowerModel.includes("o1")) {
    return "o200k_base";
  }

  // cl100k_base for GPT-4, GPT-3.5-turbo, and most modern models
  if (
    lowerModel.includes("gpt-4") ||
    lowerModel.includes("gpt-3.5") ||
    lowerModel.includes("claude") ||
    lowerModel.includes("gemini")
  ) {
    return "cl100k_base";
  }

  // Default to cl100k_base for unknown models
  return "cl100k_base";
}

/**
 * Count tokens in a text string
 * @param text - The text to count tokens for
 * @param modelId - Optional model identifier to determine encoding
 * @returns The number of tokens
 */
export function countTokens(text: string, modelId?: string): number {
  if (!text) return 0;

  try {
    const encodingName = getEncodingForModel(modelId);
    const encoder = getEncoder(encodingName);
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch (error) {
    console.warn("Error counting tokens:", error);
    // Fallback: rough estimate (4 chars per token average)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count tokens in multiple text strings
 * @param texts - Array of texts to count
 * @param modelId - Optional model identifier to determine encoding
 * @returns Total token count
 */
export function countTokensMultiple(
  texts: string[],
  modelId?: string
): number {
  return texts.reduce((total, text) => total + countTokens(text, modelId), 0);
}

/**
 * Format token count for display
 * @param count - The token count
 * @returns Formatted string (e.g., "1,234" or "1.2K")
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) {
    return count.toLocaleString();
  }
  if (count < 10000) {
    return (count / 1000).toFixed(1) + "K";
  }
  if (count < 1000000) {
    return Math.round(count / 1000).toLocaleString() + "K";
  }
  return (count / 1000000).toFixed(1) + "M";
}

/**
 * Calculate usage percentage
 * @param current - Current token count
 * @param max - Maximum token limit
 * @returns Percentage (0-100)
 */
export function calculateUsagePercentage(
  current: number,
  max: number | null | undefined
): number {
  if (!max || max <= 0) return 0;
  return Math.min((current / max) * 100, 100);
}

/**
 * Get color indicator based on usage percentage
 * @param percentage - Usage percentage (0-100)
 * @returns Color class suffix (green, yellow, red)
 */
export function getUsageColor(percentage: number): "green" | "yellow" | "red" {
  if (percentage >= 90) return "red";
  if (percentage >= 70) return "yellow";
  return "green";
}

/**
 * Extract all text content from a UIMessage
 * @param message - The UI message object
 * @returns Concatenated text from all message parts
 */
export function extractMessageText(message: UIMessage): string {
  if (!message || !message.parts) return "";

  return message.parts
    .map((part) => {
      // Handle different part types
      if (part.type === "text" && part.text) {
        return part.text;
      }
      // Reasoning parts also contain text content
      if (part.type === "reasoning" && part.text) {
        return part.text;
      }
      // File parts - use file name as placeholder
      if (part.type === "file" && part.filename) {
        return `[File: ${part.filename}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

/**
 * Count tokens in an array of UIMessages (conversation history)
 * @param messages - Array of UI messages from the conversation
 * @param modelId - Optional model identifier to determine encoding
 * @returns Total token count including message overhead
 */
export function countMessagesTokens(
  messages: UIMessage[],
  modelId?: string
): number {
  if (!messages || messages.length === 0) return 0;

  try {
    let totalTokens = 0;

    // Message overhead: Each message has structural tokens for role, formatting, etc.
    // Based on OpenAI's documentation: ~4 tokens per message
    const MESSAGE_OVERHEAD = 4;

    for (const message of messages) {
      // Extract all text content from the message
      const textContent = extractMessageText(message);

      // Count tokens in the text content
      if (textContent) {
        totalTokens += countTokens(textContent, modelId);
      }

      // Add overhead for message structure (role, name, etc.)
      totalTokens += MESSAGE_OVERHEAD;
    }

    // Additional overhead for the conversation priming
    // Based on OpenAI's guidance: ~3 tokens for conversation setup
    const CONVERSATION_OVERHEAD = 3;
    totalTokens += CONVERSATION_OVERHEAD;

    return totalTokens;
  } catch (error) {
    console.warn("Error counting message tokens:", error);
    // Fallback: rough estimate based on message count
    return messages.length * 50; // Assume ~50 tokens per message on average
  }
}

/**
 * Clean up cached encoders (call on unmount if needed)
 */
export function cleanupEncoders(): void {
  // Note: js-tiktoken encoders don't need manual cleanup
  // They will be garbage collected automatically
  encoderCache.clear();
}
