import { v } from "convex/values";
import { mutation, query, httpAction, internalMutation } from "./_generated/server";
import { components, internal } from "./_generated/api";
import {
	PersistentTextStreaming,
	StreamIdValidator,
	type StreamId,
} from "@convex-dev/persistent-text-streaming";
import type { Id } from "./_generated/dataModel";

// Initialize the persistent text streaming component
export const persistentTextStreaming = new PersistentTextStreaming(
	components.persistentTextStreaming
);

// Re-export StreamId type and validator for use in other files
export { StreamIdValidator, type StreamId };

/**
 * Create a new stream and associate it with a message
 * Called before starting the LLM generation
 */
export const createStream = mutation({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
		clientMessageId: v.optional(v.string()),
	},
	returns: v.object({
		streamId: StreamIdValidator,
		messageId: v.id("messages"),
	}),
	handler: async (ctx, args) => {
		// Verify user owns the chat
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== args.userId || chat.deletedAt) {
			throw new Error("Chat not found or access denied");
		}

		// Create the persistent stream
		const streamId = await persistentTextStreaming.createStream(ctx);

		// Create the assistant message with the stream ID
		const now = Date.now();
		const messageId = await ctx.db.insert("messages", {
			chatId: args.chatId,
			clientMessageId: args.clientMessageId,
			role: "assistant",
			content: "", // Will be populated by stream
			status: "streaming",
			streamId: streamId as string,
			createdAt: now,
			userId: args.userId,
		});

		// Update chat's lastMessageAt
		await ctx.db.patch(args.chatId, {
			lastMessageAt: now,
			updatedAt: now,
		});

		return { streamId, messageId };
	},
});

/**
 * Get the current body/content of a stream
 * Used by useStream hook for database fallback when not driving
 * IMPORTANT: Must return { text, status } format for useStream hook compatibility
 */
export const getStreamBody = query({
	args: {
		streamId: StreamIdValidator,
	},
	handler: async (ctx, args) => {
		// Get stream body from persistent streaming - returns { text, status }
		const streamBody = await persistentTextStreaming.getStreamBody(ctx, args.streamId as StreamId);

		// If stream body is empty/null, check if message has content (stream may have completed)
		if (!streamBody || (typeof streamBody === "object" && !streamBody.text)) {
			const message = await ctx.db
				.query("messages")
				.withIndex("by_stream_id", (q) => q.eq("streamId", args.streamId as string))
				.unique();

			if (message?.content) {
				// Return the message content with done status
				return {
					text: message.content,
					status: "done" as const,
				};
			}
		}

		// Return the stream body directly - useStream hook expects { text, status }
		return streamBody;
	},
});

/**
 * Get stream status and content by querying the associated message
 */
export const getStreamStatus = query({
	args: {
		streamId: v.string(),
	},
	returns: v.object({
		body: v.union(v.string(), v.null()),
		status: v.union(v.literal("streaming"), v.literal("completed"), v.literal("error"), v.null()),
		reasoning: v.optional(v.union(v.string(), v.null())),
		thinkingTimeMs: v.optional(v.union(v.number(), v.null())),
	}),
	handler: async (ctx, args) => {
		// Find the message associated with this stream first
		// We need this to check if stream completed and fall back to message content
		const message = await ctx.db
			.query("messages")
			.withIndex("by_stream_id", (q) => q.eq("streamId", args.streamId))
			.unique();

		// Get the stream body - returns {status, text} object
		const rawBody = await persistentTextStreaming.getStreamBody(ctx, args.streamId as StreamId);

		// Extract text from the StreamBody object
		let body: string | null = null;
		if (rawBody && typeof rawBody === "object" && "text" in rawBody) {
			body = (rawBody as { text: string }).text || null;
		} else if (typeof rawBody === "string") {
			body = rawBody;
		}

		// STREAM RECONNECTION FIX: If stream body is empty but message has content,
		// use the message content. This handles the case where:
		// 1. Stream completed while user was reloading
		// 2. Persistent streaming cleared the body
		// 3. But message.content has the final content
		if (!body && message?.content) {
			body = message.content;
		}

		return {
			body,
			status: (message?.status as "streaming" | "completed" | "error") ?? null,
			reasoning: message?.reasoning ?? null,
			thinkingTimeMs: message?.thinkingTimeMs ?? null,
		};
	},
});

/**
 * Mark a stream as complete and update the message content
 * Internal mutation - called from HTTP action after streaming completes
 */
export const completeStream = internalMutation({
	args: {
		messageId: v.id("messages"),
		content: v.string(),
		reasoning: v.optional(v.string()),
		thinkingTimeMs: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.messageId, {
			content: args.content,
			reasoning: args.reasoning,
			thinkingTimeMs: args.thinkingTimeMs,
			status: "completed",
		});
	},
});

/**
 * Update message content during streaming (periodic saves)
 * Internal mutation - called from HTTP action during streaming
 */
export const updateStreamContent = internalMutation({
	args: {
		messageId: v.id("messages"),
		content: v.string(),
		reasoning: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.messageId, {
			content: args.content,
			reasoning: args.reasoning,
		});
	},
});

/**
 * Prepare a chat for streaming - creates user message, stream, and assistant message
 * Called by the client before starting the stream
 */
export const prepareChat = mutation({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
		userContent: v.string(),
		userMessageId: v.optional(v.string()),
		assistantMessageId: v.optional(v.string()),
	},
	returns: v.object({
		streamId: StreamIdValidator,
		userMessageId: v.id("messages"),
		assistantMessageId: v.id("messages"),
	}),
	handler: async (ctx, args) => {
		// Verify user owns the chat
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== args.userId || chat.deletedAt) {
			throw new Error("Chat not found or access denied");
		}

		const now = Date.now();

		// Create the user message
		const userMsgId = await ctx.db.insert("messages", {
			chatId: args.chatId,
			clientMessageId: args.userMessageId,
			role: "user",
			content: args.userContent,
			status: "completed",
			createdAt: now,
			userId: args.userId,
		});

		// Create the persistent stream for assistant response
		const streamId = await persistentTextStreaming.createStream(ctx);

		// Create the assistant message placeholder with the stream ID
		const assistantMsgId = await ctx.db.insert("messages", {
			chatId: args.chatId,
			clientMessageId: args.assistantMessageId,
			role: "assistant",
			content: "", // Will be populated by stream
			status: "streaming",
			streamId: streamId as string,
			createdAt: now + 1, // Slightly after user message
			userId: args.userId,
		});

		// Update chat's lastMessageAt
		await ctx.db.patch(args.chatId, {
			lastMessageAt: now,
			updatedAt: now,
		});

		return {
			streamId,
			userMessageId: userMsgId,
			assistantMessageId: assistantMsgId,
		};
	},
});

// Types for the stream request
type StreamRequestBody = {
	streamId: string;
	messageId: string;
	apiKey: string;
	modelId: string;
	messages: Array<{
		role: string;
		content: string;
	}>;
	reasoningConfig?: {
		enabled: boolean;
		effort?: "medium" | "high";
		max_tokens?: number;
	};
};

/**
 * HTTP Action for streaming LLM responses
 * This runs on Convex infrastructure and continues even if client disconnects
 */
export const streamLLM = httpAction(async (ctx, request) => {
	// Handle CORS preflight
	if (request.method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Max-Age": "86400",
			},
		});
	}

	try {
		const body = (await request.json()) as StreamRequestBody;
		const { streamId, messageId, apiKey, modelId, messages, reasoningConfig } = body;

		if (!streamId || !apiKey || !modelId || !messages) {
			return new Response(
				JSON.stringify({ error: "Missing required fields" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		// Build the OpenRouter request
		const openRouterMessages = messages.map((m) => ({
			role: m.role as "user" | "assistant" | "system",
			content: m.content,
		}));

		// Determine if model supports reasoning
		const hasReasoning = reasoningConfig?.enabled && modelId.includes("deepseek");

		let fullContent = "";
		let fullReasoning = "";
		let reasoningStartTime: number | null = null;
		let reasoningEndTime: number | null = null;
		let chunkCount = 0;
		const CHUNKS_PER_UPDATE = 50; // Save to DB every 50 chunks

		// Generator function for the stream
		// This function runs to completion even if client disconnects
		// Using 'any' for actionCtx to avoid type conflicts between httpAction ctx and stream() expected type
		const generateResponse = async (
			actionCtx: any,
			_request: Request,
			_streamId: StreamId,
			chunkAppender: (chunk: string) => Promise<void>
		) => {
			const openRouterUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";

			const requestBody: Record<string, unknown> = {
				model: modelId,
				messages: openRouterMessages,
				stream: true,
				max_tokens: 4096,
			};

			// Add reasoning config if enabled
			if (hasReasoning && reasoningConfig) {
				requestBody.reasoning = {
					effort: reasoningConfig.effort || "medium",
					...(reasoningConfig.max_tokens && { max_tokens: reasoningConfig.max_tokens }),
				};
			}

			const response = await fetch(openRouterUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
					"HTTP-Referer": process.env.CONVEX_SITE_URL || "https://openchat.dev",
					"X-Title": "OpenChat",
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("No response body");
			}

			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (!line.startsWith("data: ")) continue;
					const data = line.slice(6);
					if (data === "[DONE]") continue;

					try {
						const parsed = JSON.parse(data);
						const delta = parsed.choices?.[0]?.delta;

						if (delta?.content) {
							fullContent += delta.content;
							await chunkAppender(delta.content);

							// Periodic database save for reconnection support
							chunkCount++;
							if (chunkCount % CHUNKS_PER_UPDATE === 0) {
								await actionCtx.runMutation(internal.streaming.updateStreamContent, {
									messageId: messageId as Id<"messages">,
									content: fullContent,
									reasoning: fullReasoning.length > 0 ? fullReasoning : undefined,
								});
							}
						}

						// Handle reasoning content (DeepSeek format)
						if (delta?.reasoning_content) {
							if (!reasoningStartTime) {
								reasoningStartTime = Date.now();
							}
							fullReasoning += delta.reasoning_content;
							reasoningEndTime = Date.now();
						}
					} catch (parseError) {
						// Log JSON parse errors for debugging OpenRouter protocol issues
						console.warn("Failed to parse streaming chunk:", {
							data: data.slice(0, 200), // Truncate for logging
							error: parseError instanceof Error ? parseError.message : String(parseError),
						});
					}
				}
			}

			// Calculate thinking time
			const thinkingTimeMs = reasoningStartTime && reasoningEndTime
				? reasoningEndTime - reasoningStartTime
				: undefined;

			// CRITICAL: Update the message record with final content
			// This runs even if the client disconnects - ensuring content is saved
			await actionCtx.runMutation(internal.streaming.completeStream, {
				messageId: messageId as Id<"messages">,
				content: fullContent,
				reasoning: fullReasoning.length > 0 ? fullReasoning : undefined,
				thinkingTimeMs,
			});
		};

		// Use the persistent streaming component
		// Type assertion needed because httpAction ctx is GenericActionCtx<any>
		// but stream() expects GenericActionCtx<GenericDataModel>
		const streamResponse = await persistentTextStreaming.stream(
			ctx as Parameters<typeof persistentTextStreaming.stream>[0],
			request,
			streamId as StreamId,
			generateResponse
		);

		// Add CORS headers
		const headers = new Headers(streamResponse.headers);
		headers.set("Access-Control-Allow-Origin", "*");
		headers.set("Vary", "Origin");

		return new Response(streamResponse.body, {
			status: streamResponse.status,
			headers,
		});
	} catch (error) {
		console.error("Stream error:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Stream failed",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			}
		);
	}
});
