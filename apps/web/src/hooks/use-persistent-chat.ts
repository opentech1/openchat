/**
 * Hook for managing persistent chat streaming using Convex
 *
 * This hook integrates with @convex-dev/persistent-text-streaming to provide
 * resilient streaming that continues even if the client disconnects.
 */

import { useCallback, useState, useRef } from "react";
import { useMutation } from "convex/react";
import { useStream } from "@convex-dev/persistent-text-streaming/react";
import { api } from "@server/convex/_generated/api";
import type { Id } from "@server/convex/_generated/dataModel";
import type { StreamId } from "@convex-dev/persistent-text-streaming";

// Get the Convex site URL for HTTP endpoints
const getConvexSiteUrl = () => {
	if (typeof window === "undefined") {
		return process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "";
	}
	return process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "";
};

export type StreamingMessage = {
	streamId: string;
	assistantMessageId: string;
	userMessageId: string;
	status: "streaming" | "complete" | "error";
};

export type UsePersistentChatOptions = {
	chatId: Id<"chats">;
	userId: Id<"users">;
	onError?: (error: Error) => void;
};

export type ChatMessage = {
	role: "user" | "assistant" | "system";
	content: string;
};

export type SendMessageOptions = {
	apiKey: string;
	modelId: string;
	conversationHistory?: ChatMessage[];
	reasoningConfig?: {
		enabled: boolean;
		effort?: "medium" | "high";
		max_tokens?: number;
	};
};

export function usePersistentChat({
	chatId,
	userId,
	onError,
}: UsePersistentChatOptions) {
	const [currentStream, setCurrentStream] = useState<StreamingMessage | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const drivenIdsRef = useRef<Set<string>>(new Set());

	const prepareChat = useMutation(api.streaming.prepareChat);

	const sendMessage = useCallback(
		async (
			content: string,
			options: SendMessageOptions
		) => {
			if (!content.trim()) return null;

			setIsSubmitting(true);

			try {
				// Generate client-side IDs for optimistic UI
				const userMessageId = crypto.randomUUID();
				const assistantMessageId = crypto.randomUUID();

				// Create user message, stream, and assistant placeholder in Convex
				const result = await prepareChat({
					chatId,
					userId,
					userContent: content,
					userMessageId,
					assistantMessageId,
				});

				// Mark this stream as driven by this client
				drivenIdsRef.current.add(result.streamId as string);

				// Set up current stream tracking
				const streamInfo: StreamingMessage = {
					streamId: result.streamId as string,
					assistantMessageId: result.assistantMessageId,
					userMessageId: result.userMessageId,
					status: "streaming",
				};
				setCurrentStream(streamInfo);

				// Start the stream by calling the Convex HTTP endpoint
				const convexSiteUrl = getConvexSiteUrl();
				const streamUrl = `${convexSiteUrl}/stream-llm`;

				// Build messages array for the LLM including conversation history
				const messages: ChatMessage[] = [
					...(options.conversationHistory || []),
					{ role: "user", content },
				];

				// Fire and forget - the stream continues on Convex even if we disconnect
				fetch(streamUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						streamId: result.streamId,
						messageId: result.assistantMessageId,
						apiKey: options.apiKey,
						modelId: options.modelId,
						messages,
						reasoningConfig: options.reasoningConfig,
					}),
				}).catch((error) => {
					console.error("Failed to start stream:", error);
					onError?.(error instanceof Error ? error : new Error("Failed to start stream"));
				});

				setIsSubmitting(false);
				return result;
			} catch (error) {
				setIsSubmitting(false);
				const err = error instanceof Error ? error : new Error("Failed to send message");
				onError?.(err);
				throw err;
			}
		},
		[chatId, userId, prepareChat, onError]
	);

	const isStreamDriven = useCallback((streamId: string) => {
		return drivenIdsRef.current.has(streamId);
	}, []);

	const clearCurrentStream = useCallback(() => {
		setCurrentStream(null);
	}, []);

	return {
		sendMessage,
		currentStream,
		isSubmitting,
		isStreamDriven,
		clearCurrentStream,
	};
}

/**
 * Hook to consume a specific stream's content
 * Use this for each assistant message that has a streamId
 */
export function useMessageStream(
	streamId: string | null,
	isDriven: boolean
) {
	const convexSiteUrl = getConvexSiteUrl();

	// Create stream URL only when we have a valid streamId
	// When streamId is null, we provide a placeholder URL that won't be used
	// because isDriven will be false (the hook uses database fallback when not driven)
	const streamUrl = streamId && convexSiteUrl
		? new URL(`${convexSiteUrl}/stream-llm`)
		: new URL("http://placeholder.invalid/stream");

	// useStream handles both HTTP streaming (when isDriven) and database fallback
	// When isDriven is false or streamId is null, it falls back to database queries
	const shouldDrive = isDriven && streamId !== null;
	const { text, status } = useStream(
		api.streaming.getStreamBody,
		streamUrl,
		shouldDrive,
		(streamId || "") as StreamId
	);

	return {
		text: text || "",
		status,
		isLoading: status === "pending" || status === "streaming",
		isComplete: status === "done",
		isError: status === "error" || status === "timeout",
	};
}
