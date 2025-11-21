/**
 * Message handling logic for chat room
 * Manages message sending, error handling, and prefetch caching
 */

import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useChat } from "@ai-sdk-tools/store";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";
import { readChatPrefetch, storeChatPrefetch } from "@/lib/chat-prefetch-cache";
import type { PrefetchMessage } from "@/lib/chat-prefetch-cache";
import { logError } from "@/lib/logger";
import { isApiError } from "@/lib/error-handling";
import { captureClientEvent } from "@/lib/posthog";
import { getMessageThrottle } from "@/config/constants";
import type { ConvexFileAttachment } from "@/lib/convex-types";
import type { ReasoningConfig } from "@/lib/reasoning-config";

const MESSAGE_THROTTLE_MS = getMessageThrottle();

export interface MessageHandlerParams {
	chatId: string;
	initialMessages: Array<{
		id: string;
		role: string;
		content: string;
		reasoning?: string;
		createdAt: string | Date;
		attachments?: Array<{
			storageId: string;
			filename: string;
			contentType: string;
			size: number;
			uploadedAt: number;
		}>;
	}>;
	onMissingRequirement: (reason: "apiKey" | "model") => void;
	removeKey: () => Promise<void>;
	dispatch: (action: any) => void;
}

export interface UseMessageHandlerResult {
	messages: UIMessage<{ createdAt?: string }>[];
	setMessages: (messages: UIMessage<{ createdAt?: string }>[]) => void;
	status: "ready" | "submitted" | "streaming" | "error";
	stop: () => void;
	handleSend: (params: {
		text: string;
		modelId: string;
		apiKey: string;
		attachments?: ConvexFileAttachment[];
		reasoningConfig?: ReasoningConfig;
	}) => Promise<void>;
}

export function useMessageHandler({
	chatId,
	initialMessages,
	onMissingRequirement,
	removeKey,
	dispatch,
}: MessageHandlerParams): UseMessageHandlerResult {
	const normalizedInitial = useMemo(
		() => initialMessages.map(normalizeMessage),
		[initialMessages],
	);

	// Store initial messages in prefetch cache
	useEffect(() => {
		if (typeof window === "undefined") return;
		const payload = normalizedInitial.map((message) => ({
			id: message.id,
			role: message.role,
			content: message.content,
			createdAt: message.createdAt.toISOString(),
		}));
		storeChatPrefetch(chatId, payload);
	}, [chatId, normalizedInitial]);

	const chatTransport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/chat",
				credentials: "include",
				body: { chatId },
			}),
		[chatId],
	);

	const { messages, setMessages, sendMessage, status, stop } = useChat({
		id: chatId,
		messages: normalizedInitial.map(toUiMessage),
		transport: chatTransport,
		experimental_throttle:
			Number.isFinite(MESSAGE_THROTTLE_MS) && MESSAGE_THROTTLE_MS > 0
				? MESSAGE_THROTTLE_MS
				: undefined,
		onFinish: async ({ message, isAbort, isError }) => {
			if (isAbort || isError) return;
			const assistantCreatedAt = new Date().toISOString();
			setMessages((prev) =>
				prev.map((item) =>
					item.id === message.id
						? {
								...item,
								metadata: { ...item.metadata, createdAt: assistantCreatedAt },
							}
						: item,
				),
			);
		},
		onError: (error) => {
			if (error instanceof Error) {
				if (error.message === "OpenRouter API key missing") {
					onMissingRequirement("apiKey");
					return;
				}
				if (error.message === "OpenRouter model not selected") {
					onMissingRequirement("model");
					return;
				}

				// Handle provider overload/rate limit errors
				const errorMessage = error.message.toLowerCase();
				if (
					errorMessage.includes("provider returned error") ||
					errorMessage.includes("failed after") ||
					errorMessage.includes("rate limit") ||
					errorMessage.includes("too many requests") ||
					errorMessage.includes("overloaded") ||
					errorMessage.includes("high load")
				) {
					toast.error("AI Provider Overloaded", {
						description: "The model provider is experiencing high load. Try again in a moment.",
						action: {
							label: "Retry",
							onClick: () => {
								// Get the last user message and resend it
								const lastUserMessage = messages.filter(m => m.role === "user").pop();
								if (lastUserMessage) {
									const textContent = lastUserMessage.parts
										.filter((p): p is { type: "text"; text: string } => p.type === "text")
										.map(p => p.text)
										.join("");
									if (textContent) {
										// Note: This would need access to selectedModel and sendMessage
										// Consider moving this retry logic to the parent component
									}
								}
							},
						},
						duration: 10000,
					});
					return;
				}

				// Handle generic errors with more helpful message
				if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
					toast.error("Connection Error", {
						description: "Unable to reach the AI service. Check your connection and try again.",
						duration: 5000,
					});
					return;
				}
			}

			// Fallback for unknown errors
			toast.error("Something went wrong", {
				description: "Failed to get a response from the AI. Please try again.",
				duration: 5000,
			});
			logError("Chat stream error", error);
		},
	});

	// Load messages from prefetch cache
	useEffect(() => {
		const entry = readChatPrefetch(chatId);
		if (!entry) return;
		const normalized = entry.messages.map((message) =>
			normalizeMessage({
				id: message.id,
				role: message.role,
				content: message.content,
				createdAt: message.createdAt,
			}),
		);
		const uiMessages = normalized.map(toUiMessage);
		setMessages(uiMessages);
	}, [chatId, setMessages]);

	// Update prefetch cache when messages change
	useEffect(() => {
		if (status !== "ready") return;
		if (!messages.length) return;
		const payload = messages
			.map((message) => {
				const textPart = message.parts.find(
					(part): part is { type: "text"; text: string } =>
						part.type === "text" && typeof part.text === "string",
				);
				const role =
					message.role === "assistant"
						? "assistant"
						: message.role === "user"
							? "user"
							: null;
				if (!role) return null;
				return {
					id: message.id,
					role,
					content: textPart?.text ?? "",
					createdAt:
						(message.metadata?.createdAt &&
							new Date(message.metadata.createdAt).toISOString()) ||
						new Date().toISOString(),
				};
			})
			.filter((message): message is PrefetchMessage => Boolean(message));

		if (payload.length === 0) return;

		const timeoutId = setTimeout(() => {
			storeChatPrefetch(chatId, payload);
		}, 500);
		return () => clearTimeout(timeoutId);
	}, [chatId, messages, status]);

	const handleSend = useCallback(
		async ({
			text,
			modelId,
			apiKey: requestApiKey,
			attachments,
			reasoningConfig,
		}: {
			text: string;
			modelId: string;
			apiKey: string;
			attachments?: ConvexFileAttachment[];
			reasoningConfig?: ReasoningConfig;
		}) => {
			const content = text.trim();
			if (!content) return;
			if (!modelId) {
				onMissingRequirement("model");
				return;
			}
			if (!requestApiKey) {
				onMissingRequirement("apiKey");
				return;
			}
			const id = crypto.randomUUID?.() ?? `${Date.now()}`;
			const createdAt = new Date().toISOString();
			try {
				await sendMessage(
					{
						id,
						role: "user",
						parts: [{ type: "text", text: content }],
						metadata: {
							createdAt,
						},
					},
					{
						body: {
							chatId,
							modelId,
							apiKey: requestApiKey,
							attachments,
							reasoningConfig,
						},
					},
				);
				captureClientEvent("chat_message_submitted", {
					chat_id: chatId,
					model_id: modelId,
					characters: content.length,
					has_api_key: Boolean(requestApiKey),
					has_attachments: Boolean(attachments && attachments.length > 0),
					attachment_count: attachments?.length || 0,
				});
			} catch (error) {
				let status: number | null = null;

				if (error instanceof Response) {
					status = error.status;
				} else if (isApiError(error) && typeof error.status === "number") {
					status = error.status;
				} else if (
					isApiError(error) &&
					error.cause &&
					typeof error.cause === "object" &&
					"status" in error.cause &&
					typeof error.cause.status === "number"
				) {
					status = error.cause.status;
				}
				if (status === 429) {
					let limitHeader: number | undefined;
					let windowHeader: number | undefined;
					if (error instanceof Response) {
						const limit =
							error.headers.get("x-ratelimit-limit") ||
							error.headers.get("X-RateLimit-Limit");
						const windowMs =
							error.headers.get("x-ratelimit-window") ||
							error.headers.get("X-RateLimit-Window");
						const parsedLimit = limit ? Number(limit) : Number.NaN;
						const parsedWindow = windowMs ? Number(windowMs) : Number.NaN;
						limitHeader = Number.isFinite(parsedLimit)
							? parsedLimit
							: undefined;
						windowHeader = Number.isFinite(parsedWindow)
							? parsedWindow
							: undefined;
					}
					captureClientEvent("chat.rate_limited", {
						chat_id: chatId,
						limit: limitHeader,
						window_ms: windowHeader,
					});
				} else if (status === 401) {
					await removeKey();
					dispatch({ type: "CLEAR_MODELS" });
					dispatch({
						type: "SET_MODELS_ERROR",
						payload:
							"OpenRouter rejected your API key. Re-enter it to continue.",
					});
					toast.error("OpenRouter API key invalid", {
						description:
							"We cleared the saved key. Add a valid key to keep chatting.",
					});
					return;
				}
				logError("Failed to send message", error);
				// Re-throw error so chat-composer can restore the message
				throw error;
			}
		},
		[chatId, sendMessage, onMissingRequirement, removeKey, dispatch],
	);

	return {
		messages,
		setMessages: setMessages as any,
		status,
		stop,
		handleSend,
	};
}
