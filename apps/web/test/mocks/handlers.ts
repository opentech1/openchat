/**
 * MSW (Mock Service Worker) Request Handlers
 *
 * Provides HTTP mocking for integration tests using MSW.
 * This allows testing API routes with realistic external API responses.
 */

import { http, HttpResponse, delay } from "msw";
import type { PathParams } from "msw";
import {
  createMockStreamChunks,
  createMockChatCompletionResponse,
  mockErrors,
  OPENROUTER_API_BASE,
} from "./openrouter";

/**
 * OpenRouter streaming response handler
 */
export function createStreamingHandler(content: string, options: {
  reasoning?: string;
  chunkSize?: number;
  delayMs?: number;
} = {}) {
  const { reasoning, chunkSize = 10, delayMs = 50 } = options;
  const chunks = createMockStreamChunks(content, { chunkSize, reasoning });

  return http.post(`${OPENROUTER_API_BASE}/chat/completions`, async () => {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          await delay(delayMs);
          const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  });
}

/**
 * OpenRouter non-streaming response handler
 */
export function createCompletionHandler(content: string, options: {
  reasoning?: string;
  model?: string;
} = {}) {
  return http.post(`${OPENROUTER_API_BASE}/chat/completions`, async () => {
    await delay(100); // Simulate network latency
    const response = createMockChatCompletionResponse({
      content,
      reasoning: options.reasoning,
      model: options.model,
    });
    return HttpResponse.json(response);
  });
}

/**
 * OpenRouter error response handler
 */
export function createErrorHandler(statusCode: number, errorKey: keyof typeof mockErrors) {
  return http.post(`${OPENROUTER_API_BASE}/chat/completions`, () => {
    return HttpResponse.json(mockErrors[errorKey], { status: statusCode });
  });
}

/**
 * OpenRouter timeout handler
 */
export function createTimeoutHandler(timeoutMs: number = 30000) {
  return http.post(`${OPENROUTER_API_BASE}/chat/completions`, async () => {
    await delay(timeoutMs);
    return HttpResponse.json({ error: "Timeout" }, { status: 504 });
  });
}

/**
 * Default OpenRouter handlers for integration tests
 */
export const openRouterHandlers = [
  // Default successful streaming response
  createStreamingHandler("This is a test response from the AI."),
];

/**
 * All mock handlers for MSW
 */
export const handlers = [
  ...openRouterHandlers,
];
