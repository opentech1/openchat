import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { webSearch } from '@valyu/ai-sdk'

// API keys (server-side only)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const VALYU_API_KEY = process.env.VALYU_API_KEY

/**
 * Chat API route for streaming AI responses
 *
 * All requests go through OpenRouter:
 * 1. OSSChat Cloud (provider: 'osschat') - Uses server's OpenRouter key, free with daily limits
 * 2. Personal OpenRouter (provider: 'openrouter') - Uses user's own OpenRouter API key
 *
 * POST /api/chat
 * Body: { messages, model, provider, apiKey?, userId? }
 *
 * Returns a streaming response compatible with AI SDK 5's useChat hook
 */
export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Parse and validate request body
          const body = await request.json()
          const {
            messages,
            model,
            provider = 'osschat',
            apiKey,
            enableWebSearch = false,
            // userId will be used for usage tracking in future
          } = body

          // Validate required fields
          if (!messages || !Array.isArray(messages)) {
            return json(
              { error: 'messages is required and must be an array' },
              { status: 400 },
            )
          }

          if (!model || typeof model !== 'string') {
            return json(
              { error: 'model is required and must be a string' },
              { status: 400 },
            )
          }

          // Validate provider-specific requirements
          if (provider === 'openrouter' && !apiKey) {
            return json(
              { error: 'apiKey is required for Personal OpenRouter' },
              { status: 400 },
            )
          }

          if (provider === 'osschat' && !OPENROUTER_API_KEY) {
            return json(
              { error: 'OSSChat Cloud is not configured on this server' },
              { status: 500 },
            )
          }

          // AI SDK 5 messages have 'parts' array instead of 'content'
          for (const message of messages) {
            if (!message.role) {
              return json(
                { error: 'Each message must have a role property' },
                { status: 400 },
              )
            }
            if (!['user', 'assistant', 'system'].includes(message.role)) {
              return json(
                {
                  error: 'Message role must be one of: user, assistant, system',
                },
                { status: 400 },
              )
            }
            if (!message.parts && !message.content) {
              return json(
                { error: 'Each message must have parts or content' },
                { status: 400 },
              )
            }
          }

          // All requests go through OpenRouter - just different API keys
          const openrouterKey = provider === 'osschat' 
            ? OPENROUTER_API_KEY! 
            : apiKey!
          
          const openrouter = createOpenRouter({ apiKey: openrouterKey })
          const aiModel = openrouter(model)

          // Convert UI messages to model messages (AI SDK 5 format)
          const modelMessages = await convertToModelMessages(messages)

          // Stream the response using AI SDK
          // Configure options based on features
          const streamOptions: Parameters<typeof streamText>[0] = {
            model: aiModel,
            messages: modelMessages,
          }

          // Add web search tool if enabled and API key available
          if (enableWebSearch && VALYU_API_KEY) {
            streamOptions.tools = {
              webSearch: webSearch({ apiKey: VALYU_API_KEY }),
            }
            streamOptions.stopWhen = stepCountIs(5) // Limit tool call iterations
          }

          // Enable thinking for Claude models
          if (model.includes('claude')) {
            streamOptions.providerOptions = {
              anthropic: {
                thinking: { type: 'enabled', budgetTokens: 10000 },
              },
            }
          }

          const result = streamText(streamOptions)

          // Return streaming response compatible with useChat (AI SDK 5 format)
          // Include metadata with model and usage info for client-side cost tracking
          return result.toUIMessageStreamResponse({
            messageMetadata: ({ part }) => {
              if (part.type === 'start') {
                return {
                  createdAt: Date.now(),
                  model,
                  provider,
                }
              }

              if (part.type === 'finish') {
                return {
                  inputTokens: part.totalUsage?.inputTokens,
                  outputTokens: part.totalUsage?.outputTokens,
                  totalTokens: part.totalUsage?.totalTokens,
                }
              }
            },
          })
        } catch (error) {
          console.error('[Chat API Error]', error)

          // Handle JSON parse errors
          if (error instanceof SyntaxError) {
            return json(
              { error: 'Invalid JSON in request body' },
              { status: 400 },
            )
          }

          // Handle OpenRouter/AI SDK errors
          if (error instanceof Error) {
            // Check for common OpenRouter errors
            if (
              error.message.includes('401') ||
              error.message.includes('Unauthorized')
            ) {
              return json(
                {
                  error:
                    'Invalid API key. Please check your OpenRouter API key.',
                },
                { status: 401 },
              )
            }

            if (
              error.message.includes('429') ||
              error.message.includes('rate limit')
            ) {
              return json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 },
              )
            }

            if (
              error.message.includes('model') ||
              error.message.includes('Model')
            ) {
              return json(
                { error: `Model error: ${error.message}` },
                { status: 400 },
              )
            }

            return json(
              {
                error:
                  error.message ||
                  'An error occurred while processing your request',
              },
              { status: 500 },
            )
          }

          return json(
            { error: 'An unexpected error occurred' },
            { status: 500 },
          )
        }
      },
    },
  },
})
