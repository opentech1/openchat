import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
	streamText,
	convertToModelMessages,
	stepCountIs,
	generateId,
	UI_MESSAGE_STREAM_HEADERS,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { webSearch } from "@valyu/ai-sdk";
import { createResumableStreamContext } from "resumable-stream";
import { convexServerClient } from "@/lib/convex-server";
import { api } from "@server/convex/_generated/api";
import type { Id } from "@server/convex/_generated/dataModel";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VALYU_API_KEY = process.env.VALYU_API_KEY;
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

function getStreamContext() {
	if (!REDIS_URL) {
		return null;
	}
	try {
		return createResumableStreamContext({
			waitUntil: async (promise: Promise<unknown>) => {
				await promise;
			},
		});
	} catch {
		return null;
	}
}

export const Route = createFileRoute("/api/chat")({
		server: {
			handlers: {
				GET: async ({ request }) => {
					const streamContext = getStreamContext();
					if (!streamContext) {
						return new Response(null, { status: 204 });
					}
					const url = new URL(request.url);
					const chatId = url.searchParams.get("chatId");
					const userId = url.searchParams.get("userId");
					if (!chatId || !userId || !convexServerClient) {
						return new Response(null, { status: 204 });
					}
					const activeStreamId = await convexServerClient.query(api.chats.getActiveStream, {
						chatId: chatId as Id<"chats">,
						userId: userId as Id<"users">,
					});
					if (!activeStreamId) {
						return new Response(null, { status: 204 });
					}
					const resumedStream = await streamContext.resumeExistingStream(activeStreamId);
					if (!resumedStream) {
						return new Response(null, { status: 204 });
					}
					return new Response(resumedStream, {
						headers: UI_MESSAGE_STREAM_HEADERS,
					});
				},
				POST: async ({ request }) => {
				const abortSignal = request.signal;

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
					const openrouter = createOpenRouter({ apiKey: openrouterKey });
					const aiModel = openrouter(model);

					const modelMessages = await convertToModelMessages(messages);

					const streamOptions: Parameters<typeof streamText>[0] = {
						model: aiModel as Parameters<typeof streamText>[0]["model"],
						messages: modelMessages,
						abortSignal,
					};

					if (enableWebSearch && VALYU_API_KEY) {
						streamOptions.tools = {
							webSearch: webSearch({ apiKey: VALYU_API_KEY }) as any,
						};
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

					if (chatId && userId && convexServerClient) {
						await convexServerClient.mutation(api.chats.setActiveStream, {
							chatId: chatId as Id<"chats">,
							userId: userId as Id<"users">,
							streamId: null,
						});
					}

					const result = streamText(streamOptions);

					result.consumeStream();

					return result.toUIMessageStreamResponse({
						sendReasoning: true,
						originalMessages: messages,
						generateMessageId: generateId,
						onFinish: async () => {
							if (chatId && userId && convexServerClient) {
								await convexServerClient.mutation(api.chats.setActiveStream, {
									chatId: chatId as Id<"chats">,
									userId: userId as Id<"users">,
									streamId: null,
								});
							}
						},
						async consumeSseStream({ stream }) {
							const streamContext = getStreamContext();
							if (!streamContext || !chatId || !userId) {
								return;
							}
							try {
								const streamId = generateId();
								await streamContext.createNewResumableStream(streamId, () => stream);
								if (convexServerClient) {
									await convexServerClient.mutation(api.chats.setActiveStream, {
										chatId: chatId as Id<"chats">,
										userId: userId as Id<"users">,
										streamId,
									});
								}
							} catch {
								return;
							}
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
