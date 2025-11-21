/**
 * OpenRouter API mocks for testing
 *
 * This module provides mock implementations of OpenRouter API responses.
 * Can be used with fetch mocking or as standalone mock data.
 *
 * NOTE: For production use with MSW (Mock Service Worker), install msw package:
 * npm install -D msw
 *
 * @module mocks/openrouter
 */

import { vi, type Mock } from "vitest";

/**
 * OpenRouter API base URL
 */
export const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

/**
 * Mock OpenRouter model information
 */
export interface MockOpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
  top_provider: {
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  per_request_limits: {
    prompt_tokens: string;
    completion_tokens: string;
  } | null;
}

/**
 * Mock Claude 4 Sonnet model
 */
export const mockClaudeSonnetModel: MockOpenRouterModel = {
  id: "anthropic/claude-4-sonnet",
  name: "Claude 4 Sonnet",
  description: "Anthropic's most powerful model with advanced reasoning capabilities",
  pricing: {
    prompt: "0.000003",
    completion: "0.000015",
  },
  context_length: 200000,
  architecture: {
    modality: "text",
    tokenizer: "Claude",
    instruct_type: "claude",
  },
  top_provider: {
    max_completion_tokens: 8192,
    is_moderated: false,
  },
  per_request_limits: null,
};

/**
 * Mock GPT-4 model
 */
export const mockGPT4Model: MockOpenRouterModel = {
  id: "openai/gpt-4-turbo",
  name: "GPT-4 Turbo",
  description: "OpenAI's most capable model with vision support",
  pricing: {
    prompt: "0.00001",
    completion: "0.00003",
  },
  context_length: 128000,
  architecture: {
    modality: "text+image",
    tokenizer: "GPT",
    instruct_type: "chatml",
  },
  top_provider: {
    max_completion_tokens: 4096,
    is_moderated: true,
  },
  per_request_limits: null,
};

/**
 * Mock DeepSeek R1 model (reasoning model)
 */
export const mockDeepSeekR1Model: MockOpenRouterModel = {
  id: "deepseek/deepseek-r1",
  name: "DeepSeek R1",
  description: "Advanced reasoning model with chain-of-thought capabilities",
  pricing: {
    prompt: "0.000001",
    completion: "0.000004",
  },
  context_length: 64000,
  architecture: {
    modality: "text",
    tokenizer: "DeepSeek",
    instruct_type: null,
  },
  top_provider: {
    max_completion_tokens: 8192,
    is_moderated: false,
  },
  per_request_limits: null,
};

/**
 * All mock models
 */
export const mockModels: MockOpenRouterModel[] = [
  mockClaudeSonnetModel,
  mockGPT4Model,
  mockDeepSeekR1Model,
];

/**
 * Mock OpenRouter chat completion response
 */
export interface MockChatCompletionResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Create a mock chat completion response
 *
 * @param options - Options for the mock response
 * @returns Mock response object
 *
 * @example
 * ```typescript
 * const response = createMockChatCompletionResponse({
 *   content: "This is a test response",
 *   model: "anthropic/claude-4-sonnet"
 * });
 * ```
 */
export function createMockChatCompletionResponse(
  options: {
    content?: string;
    model?: string;
    reasoning?: string;
    promptTokens?: number;
    completionTokens?: number;
  } = {}
): MockChatCompletionResponse {
  const {
    content = "This is a mock AI response.",
    model = mockClaudeSonnetModel.id,
    reasoning,
    promptTokens = 50,
    completionTokens = 25,
  } = options;

  const message: any = {
    role: "assistant",
    content,
  };

  if (reasoning) {
    message.reasoning_content = reasoning;
  }

  return {
    id: `chatcmpl-mock-${Math.random().toString(36).substring(2, 15)}`,
    model,
    created: Math.floor(Date.now() / 1000),
    choices: [
      {
        index: 0,
        message,
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Mock streaming chat completion chunk
 */
export interface MockStreamChunk {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * Create mock streaming chunks for a response
 *
 * @param content - Content to stream
 * @param options - Additional options
 * @returns Array of mock stream chunks
 *
 * @example
 * ```typescript
 * const chunks = createMockStreamChunks("Hello world", {
 *   chunkSize: 5,
 *   reasoning: "Let me think..."
 * });
 * ```
 */
export function createMockStreamChunks(
  content: string,
  options: {
    model?: string;
    chunkSize?: number;
    reasoning?: string;
  } = {}
): MockStreamChunk[] {
  const {
    model = mockClaudeSonnetModel.id,
    chunkSize = 10,
    reasoning,
  } = options;

  const chunks: MockStreamChunk[] = [];
  const id = `chatcmpl-mock-${Math.random().toString(36).substring(2, 15)}`;
  const created = Math.floor(Date.now() / 1000);

  // First chunk with role
  chunks.push({
    id,
    model,
    created,
    choices: [
      {
        index: 0,
        delta: { role: "assistant" },
        finish_reason: null,
      },
    ],
  });

  // Reasoning chunks if provided
  if (reasoning) {
    for (let i = 0; i < reasoning.length; i += chunkSize) {
      const chunk = reasoning.substring(i, i + chunkSize);
      chunks.push({
        id,
        model,
        created,
        choices: [
          {
            index: 0,
            delta: { reasoning_content: chunk },
            finish_reason: null,
          },
        ],
      });
    }
  }

  // Content chunks
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.substring(i, i + chunkSize);
    chunks.push({
      id,
      model,
      created,
      choices: [
        {
          index: 0,
          delta: { content: chunk },
          finish_reason: null,
        },
      ],
    });
  }

  // Final chunk
  chunks.push({
    id,
    model,
    created,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  });

  return chunks;
}

/**
 * Mock error response from OpenRouter
 */
export interface MockErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

/**
 * Create a mock error response
 *
 * @param message - Error message
 * @param type - Error type
 * @param code - Error code
 * @returns Mock error response
 *
 * @example
 * ```typescript
 * const error = createMockErrorResponse("Invalid API key", "authentication_error", "invalid_api_key");
 * ```
 */
export function createMockErrorResponse(
  message: string,
  type: string = "invalid_request_error",
  code: string = "invalid_request"
): MockErrorResponse {
  return {
    error: {
      message,
      type,
      code,
    },
  };
}

/**
 * Common mock error responses
 */
export const mockErrors = {
  invalidApiKey: createMockErrorResponse(
    "Invalid API key provided",
    "authentication_error",
    "invalid_api_key"
  ),
  rateLimitExceeded: createMockErrorResponse(
    "Rate limit exceeded",
    "rate_limit_error",
    "rate_limit_exceeded"
  ),
  insufficientCredits: createMockErrorResponse(
    "Insufficient credits",
    "insufficient_quota",
    "insufficient_quota"
  ),
  modelNotFound: createMockErrorResponse(
    "Model not found",
    "invalid_request_error",
    "model_not_found"
  ),
  contentTooLong: createMockErrorResponse(
    "Content exceeds maximum length",
    "invalid_request_error",
    "context_length_exceeded"
  ),
};

/**
 * Mock fetch function for OpenRouter API
 *
 * @param responses - Map of URL patterns to response data
 * @returns Mock fetch function
 *
 * @example
 * ```typescript
 * globalThis.fetch = createMockOpenRouterFetch({
 *   "/models": mockModels,
 *   "/chat/completions": createMockChatCompletionResponse()
 * });
 * ```
 */
export function createMockOpenRouterFetch(
  responses: Record<string, any> = {}
): Mock<[RequestInfo | URL, RequestInit?], Promise<Response>> {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    // Find matching response
    for (const [pattern, data] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        const responseData = typeof data === "function" ? data(init) : data;

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers({
            "content-type": "application/json",
          }),
          json: async () => responseData,
          text: async () => JSON.stringify(responseData),
          blob: async () => new Blob([JSON.stringify(responseData)]),
          arrayBuffer: async () => new ArrayBuffer(0),
          clone: function() { return this; },
        } as Response;
      }
    }

    // Default 404 response
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers(),
      json: async () => createMockErrorResponse("Not found", "not_found", "not_found"),
      text: async () => JSON.stringify(createMockErrorResponse("Not found", "not_found", "not_found")),
      blob: async () => new Blob([]),
      arrayBuffer: async () => new ArrayBuffer(0),
      clone: function() { return this; },
    } as Response;
  });
}

/**
 * Setup OpenRouter API mocks for testing
 *
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * setupOpenRouterMocks({
 *   models: mockModels,
 *   defaultResponse: createMockChatCompletionResponse()
 * });
 * ```
 */
export function setupOpenRouterMocks(
  options: {
    models?: MockOpenRouterModel[];
    defaultResponse?: MockChatCompletionResponse;
  } = {}
) {
  const {
    models = mockModels,
    defaultResponse = createMockChatCompletionResponse(),
  } = options;

  beforeEach(() => {
    // Setup default fetch mock
    globalThis.fetch = createMockOpenRouterFetch({
      "/models": { data: models },
      "/chat/completions": defaultResponse,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
}

/**
 * Create a mock streaming response using ReadableStream
 *
 * @param chunks - Array of mock stream chunks
 * @returns Mock Response with streaming body
 *
 * @example
 * ```typescript
 * const chunks = createMockStreamChunks("Hello world");
 * const response = createMockStreamingResponse(chunks);
 * ```
 */
export function createMockStreamingResponse(chunks: MockStreamChunk[]): Response {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  const stream = new ReadableStream({
    async pull(controller) {
      if (chunkIndex < chunks.length) {
        const chunk = chunks[chunkIndex++];
        const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
        controller.enqueue(encoder.encode(sseData));
      } else {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    }),
    body: stream,
    json: async () => { throw new Error("Cannot call json() on streaming response"); },
    text: async () => { throw new Error("Cannot call text() on streaming response"); },
    blob: async () => new Blob([]),
    arrayBuffer: async () => new ArrayBuffer(0),
    clone: function() { return this; },
  } as Response;
}

/**
 * Helper to simulate successful chat completion
 *
 * @param message - User message
 * @param modelId - Model ID to use
 * @returns Mock response with AI reply
 *
 * @example
 * ```typescript
 * const response = mockSuccessfulChatCompletion("Hello", "anthropic/claude-4-sonnet");
 * ```
 */
export function mockSuccessfulChatCompletion(
  message: string,
  modelId: string = mockClaudeSonnetModel.id
): MockChatCompletionResponse {
  return createMockChatCompletionResponse({
    content: `This is a response to: "${message}"`,
    model: modelId,
    promptTokens: message.length,
    completionTokens: 50,
  });
}

/**
 * Helper to simulate chat completion with reasoning
 *
 * @param message - User message
 * @param modelId - Model ID to use
 * @returns Mock response with reasoning and AI reply
 *
 * @example
 * ```typescript
 * const response = mockReasoningChatCompletion("Solve 2+2", "deepseek/deepseek-r1");
 * ```
 */
export function mockReasoningChatCompletion(
  message: string,
  modelId: string = mockDeepSeekR1Model.id
): MockChatCompletionResponse {
  return createMockChatCompletionResponse({
    content: `The answer is 4. Here's my response to: "${message}"`,
    reasoning: "Let me think through this step by step:\n1. First, I need to understand the question\n2. Then I'll work through the logic\n3. Finally, I'll provide the answer",
    model: modelId,
    promptTokens: message.length,
    completionTokens: 100,
  });
}

/**
 * Mock OpenRouter models list response
 */
export const mockModelsListResponse = {
  data: mockModels,
};
