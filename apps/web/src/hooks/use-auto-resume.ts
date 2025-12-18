"use client";

import { useEffect } from "react";

/**
 * Message type for auto-resume functionality.
 * Compatible with both simple message formats and the codebase's NormalizedMessage type.
 */
interface Message {
	role: "user" | "assistant" | "system";
	content: string;
	id?: string;
}

/**
 * Data stream part type for handling appended messages.
 */
interface DataStreamPart {
	type: string;
	data?: string;
}

/**
 * Parameters for the useAutoResume hook.
 */
interface UseAutoResumeParams {
	/**
	 * Whether auto-resume is enabled.
	 * When false, the hook will not attempt to resume streams.
	 */
	autoResume: boolean;

	/**
	 * Initial messages from server/storage.
	 * Used to determine if the last conversation was interrupted.
	 */
	initialMessages: Message[];

	/**
	 * Function to resume the stream.
	 * Called when an incomplete conversation is detected.
	 */
	resumeStream: () => void;

	/**
	 * Function to update messages.
	 * Used to append messages received from the data stream.
	 */
	setMessages: (messages: Message[]) => void;

	/**
	 * Optional data stream for handling appended messages.
	 * When present, the hook will parse and append messages from the stream.
	 */
	dataStream?: DataStreamPart[];
}

/**
 * Hook to automatically resume incomplete conversations on page reload.
 *
 * This hook detects when a conversation was interrupted (last message was from
 * the user, meaning the AI response was cut off) and automatically attempts to
 * resume the stream.
 *
 * It also handles appended messages from a data stream, parsing and adding them
 * to the message list.
 *
 * @example
 * ```tsx
 * function ChatRoom() {
 *   const { messages, setMessages, resumeStream } = useChat();
 *   const { initialMessages } = useChatSession({ chatId, userId });
 *
 *   useAutoResume({
 *     autoResume: true,
 *     initialMessages: initialMessages ?? [],
 *     resumeStream,
 *     setMessages,
 *   });
 *
 *   return <MessageList messages={messages} />;
 * }
 * ```
 *
 * @param params - Configuration for auto-resume behavior
 */
export function useAutoResume({
	autoResume,
	initialMessages,
	resumeStream,
	setMessages,
	dataStream,
}: UseAutoResumeParams): void {
	// Resume stream if last message was from user (incomplete conversation)
	// This runs only once on mount to avoid re-triggering on message updates
	useEffect(() => {
		if (!autoResume) return;

		// Check if there are any messages to evaluate
		if (!initialMessages || initialMessages.length === 0) return;

		const mostRecentMessage = initialMessages.at(-1);

		// If the last message was from the user, the AI response was interrupted
		// Attempt to resume the stream to complete the response
		if (mostRecentMessage?.role === "user") {
			resumeStream();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally only run once on mount
	}, []);

	// Handle appended messages from data stream
	// This allows the stream to push new messages that should be added to the list
	useEffect(() => {
		if (!dataStream || dataStream.length === 0) return;

		const dataPart = dataStream[0];

		// Check for the append message type
		if (dataPart.type === "data-appendMessage" && dataPart.data) {
			try {
				const message = JSON.parse(dataPart.data) as Message;

				// Validate the parsed message has required fields
				if (!message.role || typeof message.content !== "string") {
					console.error("Invalid message format in data stream:", message);
					return;
				}

				setMessages([...initialMessages, message]);
			} catch (error) {
				console.error("Failed to parse appended message:", error);
			}
		}
	}, [dataStream, initialMessages, setMessages]);
}
