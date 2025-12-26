import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { streamText, convertToModelMessages } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * Chat API route for streaming AI responses via OpenRouter
 *
 * POST /api/chat
 * Body: { messages: UIMessage[], model: string, apiKey: string }
 *
 * AI SDK 5 sends messages in UIMessage format with 'parts' array.
 * We convert to ModelMessages before sending to the model.
 *
 * Returns a streaming response compatible with AI SDK 5's useChat hook
 */
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Parse and validate request body
          const body = await request.json();
          const { messages, model, apiKey } = body;

          // Validate required fields
          if (!messages || !Array.isArray(messages)) {
            return json(
              { error: "messages is required and must be an array" },
              { status: 400 }
            );
          }

          if (!model || typeof model !== "string") {
            return json(
              { error: "model is required and must be a string" },
              { status: 400 }
            );
          }

          if (!apiKey || typeof apiKey !== "string") {
            return json(
              { error: "apiKey is required and must be a string" },
              { status: 400 }
            );
          }

          // AI SDK 5 messages have 'parts' array instead of 'content'
          // We need to validate that messages have the expected structure
          for (const message of messages) {
            if (!message.role) {
              return json(
                { error: "Each message must have a role property" },
                { status: 400 }
              );
            }
            if (!["user", "assistant", "system"].includes(message.role)) {
              return json(
                { error: "Message role must be one of: user, assistant, system" },
                { status: 400 }
              );
            }
            // AI SDK 5 uses 'parts' instead of 'content'
            if (!message.parts && !message.content) {
              return json(
                { error: "Each message must have parts or content" },
                { status: 400 }
              );
            }
          }

          // Create OpenRouter provider with user's API key
          const openrouter = createOpenRouter({ apiKey });

          // Convert UI messages to model messages (AI SDK 5 format)
          const modelMessages = await convertToModelMessages(messages);

          // Stream the response using AI SDK
          // Enable reasoning/thinking for Claude models
          const result = streamText({
            model: openrouter(model),
            messages: modelMessages,
            // Enable thinking for Claude models (supports claude-3-7-sonnet, claude-sonnet-4, claude-opus-4)
            ...(model.includes('claude') ? {
              providerOptions: {
                anthropic: {
                  thinking: { type: 'enabled', budgetTokens: 10000 },
                },
              },
            } : {}),
          });

          // Return streaming response compatible with useChat (AI SDK 5 format)
          return result.toUIMessageStreamResponse();
        } catch (error) {
          console.error("[Chat API Error]", error);

          // Handle JSON parse errors
          if (error instanceof SyntaxError) {
            return json({ error: "Invalid JSON in request body" }, { status: 400 });
          }

          // Handle OpenRouter/AI SDK errors
          if (error instanceof Error) {
            // Check for common OpenRouter errors
            if (error.message.includes("401") || error.message.includes("Unauthorized")) {
              return json(
                { error: "Invalid API key. Please check your OpenRouter API key." },
                { status: 401 }
              );
            }

            if (error.message.includes("429") || error.message.includes("rate limit")) {
              return json(
                { error: "Rate limit exceeded. Please try again later." },
                { status: 429 }
              );
            }

            if (error.message.includes("model") || error.message.includes("Model")) {
              return json(
                { error: `Model error: ${error.message}` },
                { status: 400 }
              );
            }

            return json(
              { error: error.message || "An error occurred while processing your request" },
              { status: 500 }
            );
          }

          return json(
            { error: "An unexpected error occurred" },
            { status: 500 }
          );
        }
      },
    },
  },
});
