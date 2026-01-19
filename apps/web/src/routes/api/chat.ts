import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
	streamText,
	convertToModelMessages,
	stepCountIs,
	generateId,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { webSearch } from "@valyu/ai-sdk";
import { redis } from "@/lib/redis";
import { convexServerClient } from "@/lib/convex-server";
import { api } from "@server/convex/_generated/api";
import type { Id } from "@server/convex/_generated/dataModel";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VALYU_API_KEY = process.env.VALYU_API_KEY;

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const chatId = url.searchParams.get("chatId");
				const lastId = url.searchParams.get("lastId") || "0";

				if (!chatId) {
					return json({ error: "chatId is required" }, { status: 400 });
				}

				const redisReady = await redis.ensureConnected();
				if (!redisReady) {
					console.log("[Chat API GET] Redis not available");
					return json({ error: "Redis not configured" }, { status: 503 });
				}

				console.log("[Chat API GET] Reading stream for chat:", chatId);
				const meta = await redis.stream.getMeta(chatId);
				if (!meta) {
					console.log("[Chat API GET] No stream metadata found");
					return new Response(null, { status: 204 });
				}
				console.log("[Chat API GET] Stream meta:", meta.status);

				const encoder = new TextEncoder();
				const stream = new ReadableStream({
					async start(controller) {
						let currentLastId = lastId;
						let isComplete = false;

						while (!isComplete) {
							const tokens = await redis.stream.read(chatId, currentLastId);

							for (const token of tokens) {
								if (token.type === "done") {
									isComplete = true;
									controller.enqueue(
										encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
									);
									break;
								}

								if (token.type === "error") {
									controller.enqueue(
										encoder.encode(
											`data: ${JSON.stringify({ type: "error", text: token.text })}\n\n`,
										),
									);
									isComplete = true;
									break;
								}

								controller.enqueue(
									encoder.encode(
										`data: ${JSON.stringify({ type: token.type, text: token.text, id: token.id })}\n\n`,
									),
								);
								currentLastId = token.id;
							}

							if (!isComplete && tokens.length === 0) {
								const currentMeta = await redis.stream.getMeta(chatId);
								if (currentMeta?.status !== "streaming") {
									isComplete = true;
								} else {
									await new Promise((r) => setTimeout(r, 50));
								}
							}
						}

						controller.close();
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					},
				});
			},

			POST: async ({ request }) => {
				const abortSignal = request.signal;
				const redisReady = await redis.ensureConnected();
				console.log("[Chat API POST] Redis ready:", redisReady);

				try {
					const body = await request.json();
					const {
						messages,
						model,
						provider = "osschat",
						apiKey,
						enableWebSearch = false,
						reasoningEffort,
						maxSteps = 5,
						chatId,
						userId,
					} = body;

					if (!messages || !Array.isArray(messages)) {
						return json({ error: "messages is required and must be an array" }, { status: 400 });
					}

					if (!model || typeof model !== "string") {
						return json({ error: "model is required and must be a string" }, { status: 400 });
					}

					if (provider === "openrouter" && !apiKey) {
						return json({ error: "apiKey is required for Personal OpenRouter" }, { status: 400 });
					}

					if (provider === "osschat" && !OPENROUTER_API_KEY) {
						return json(
							{ error: "OSSChat Cloud is not configured on this server" },
							{ status: 500 },
						);
					}

					for (const message of messages) {
						if (!message.role) {
							return json({ error: "Each message must have a role property" }, { status: 400 });
						}
						if (!["user", "assistant", "system"].includes(message.role)) {
							return json(
								{ error: "Message role must be one of: user, assistant, system" },
								{ status: 400 },
							);
						}
						if (!message.parts && !message.content) {
							return json({ error: "Each message must have parts or content" }, { status: 400 });
						}
					}

					const openrouterKey = provider === "osschat" ? OPENROUTER_API_KEY! : apiKey!;
					const openRouter = createOpenRouter({ apiKey: openrouterKey });
					const aiModel = openRouter(model);

					const modelMessages = await convertToModelMessages(messages);

					const streamOptions: Parameters<typeof streamText>[0] = {
						model: aiModel as Parameters<typeof streamText>[0]["model"],
						messages: modelMessages,
						abortSignal,
					};

					if (enableWebSearch && VALYU_API_KEY) {
						streamOptions.tools = {
							webSearch: webSearch({ apiKey: VALYU_API_KEY }),
						} as any;
					}

					const hasTools = enableWebSearch && VALYU_API_KEY;
					const stepLimit = hasTools ? Math.max(1, Math.min(10, maxSteps)) : 1;
					streamOptions.stopWhen = stepCountIs(stepLimit);

					if (reasoningEffort && reasoningEffort !== "none") {
						const effortValue = reasoningEffort as "low" | "medium" | "high";
						streamOptions.providerOptions = {
							...streamOptions.providerOptions,
							openrouter: {
								reasoning: {
									effort: effortValue,
								},
							},
						};
					}

					const messageId = generateId();
					const streamId = `${chatId}-${messageId}`;

					if (chatId && userId && redisReady) {
						console.log("[Chat API POST] Initializing Redis stream for chat:", chatId);
						await redis.stream.init(chatId, userId, messageId);
					}

					if (chatId && userId) {
						if (!convexServerClient) {
							console.error("[Chat API] convexServerClient is null - VITE_CONVEX_URL not set?");
						} else {
							try {
								console.log("[Chat API] Setting active stream:", streamId);
								await convexServerClient.mutation(api.chats.setActiveStream, {
									chatId: chatId as Id<"chats">,
									userId: userId as Id<"users">,
									streamId,
								});
								console.log("[Chat API] Active stream set successfully");
							} catch (err) {
								console.error("[Chat API] Failed to set active stream:", err);
							}
						}
					}

					const result = streamText(streamOptions);

					const encoder = new TextEncoder();
					let fullContent = "";
					let fullReasoning = "";

					const stream = new ReadableStream({
						async start(controller) {
							const markStreamInterrupted = async () => {
								if (chatId && redisReady) {
									await redis.stream.complete(chatId);
								}
							};
							
							try {
								for await (const part of result.fullStream) {
									if (abortSignal?.aborted) {
										console.log("[Chat API POST] Client disconnected, marking stream interrupted");
										await markStreamInterrupted();
										controller.close();
										return;
									}
									
									if (part.type === "text-delta") {
										const text = part.text;
										fullContent += text;

										controller.enqueue(
											encoder.encode(
												`data: ${JSON.stringify({ type: "text", text })}\n\n`,
											),
										);

										if (chatId && redisReady) {
											await redis.stream.append(chatId, text, "text");
										}
									} else if (part.type === "reasoning-delta") {
										const text = (part as { type: "reasoning-delta"; text: string }).text;
										fullReasoning += text;

										controller.enqueue(
											encoder.encode(
												`data: ${JSON.stringify({ type: "reasoning", text })}\n\n`,
											),
										);

										if (chatId && redisReady) {
											await redis.stream.append(chatId, text, "reasoning");
										}
									}
								}

								controller.enqueue(
									encoder.encode(
										`data: ${JSON.stringify({ 
											type: "done", 
											content: fullContent, 
											reasoning: fullReasoning,
											messageId,
										})}\n\n`,
									),
								);

								if (chatId && redisReady) {
									await redis.stream.complete(chatId);
									console.log("[Chat API POST] Redis stream completed");
								}

								if (chatId && userId && convexServerClient) {
									await convexServerClient.mutation(api.chats.setActiveStream, {
										chatId: chatId as Id<"chats">,
										userId: userId as Id<"users">,
										streamId: null,
									});
								}

								controller.close();
							} catch (err) {
								if (err instanceof Error && err.name === "AbortError") {
									console.log("[Chat API POST] Stream aborted, marking stream interrupted");
									await markStreamInterrupted();
									controller.close();
									return;
								}
								
								const errorMessage = err instanceof Error ? err.message : "Stream error";

								controller.enqueue(
									encoder.encode(
										`data: ${JSON.stringify({ type: "error", text: errorMessage })}\n\n`,
									),
								);

								if (chatId && redisReady) {
									await redis.stream.error(chatId, errorMessage);
								}

								controller.close();
							}
						},
					});

					return new Response(stream, {
						headers: {
							"Content-Type": "text/event-stream",
							"Cache-Control": "no-cache",
							Connection: "keep-alive",
							"X-Message-Id": messageId,
						},
					});
				} catch (error) {
					console.error("[Chat API Error]", error);

					if (error instanceof SyntaxError) {
						return json({ error: "Invalid JSON in request body" }, { status: 400 });
					}

					if (error instanceof Error) {
						if (error.message.includes("401") || error.message.includes("Unauthorized")) {
							return json(
								{ error: "Invalid API key. Please check your OpenRouter API key." },
								{ status: 401 },
							);
						}

						if (error.message.includes("429") || error.message.includes("rate limit")) {
							return json(
								{ error: "Rate limit exceeded. Please try again later." },
								{ status: 429 },
							);
						}

						if (error.message.includes("model") || error.message.includes("Model")) {
							return json({ error: `Model error: ${error.message}` }, { status: 400 });
						}

						return json(
							{ error: error.message || "An error occurred while processing your request" },
							{ status: 500 },
						);
					}

					return json({ error: "An unexpected error occurred" }, { status: 500 });
				}
			},
		},
	},
});
