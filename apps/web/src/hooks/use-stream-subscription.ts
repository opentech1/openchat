/**
 * React hook for subscribing to SSE token streams
 *
 * Provides a simple interface for connecting to the streaming API
 * and receiving tokens in real-time with automatic reconnection support.
 *
 * USAGE:
 * ```tsx
 * const { status, reconnect } = useStreamSubscription({
 *   streamId: "abc123",
 *   onToken: (token) => appendToMessage(token),
 *   onComplete: () => markMessageComplete(),
 *   onError: (error) => handleError(error),
 * });
 * ```
 *
 * FEATURES:
 * - Automatic connection when streamId changes
 * - Cursor-based resumption for reconnection
 * - Status tracking (idle, connecting, connected, complete, error)
 * - Manual reconnect function
 * - Cleanup on unmount
 */

import { useEffect, useState, useRef, useCallback } from "react";

/**
 * Stream subscription status
 */
export type StreamStatus =
	| "idle"
	| "connecting"
	| "connected"
	| "complete"
	| "error";

/**
 * Token data received from stream
 */
export interface StreamToken {
	id: string;
	delta: string;
	reasoning?: string;
	ts?: number;
}

/**
 * Completion metadata from stream
 */
export interface StreamCompletion {
	totalTokens?: number;
	completedAt?: number;
}

/**
 * Hook options
 */
export interface UseStreamSubscriptionOptions {
	/**
	 * Stream ID to subscribe to (null to not connect)
	 */
	streamId: string | null;

	/**
	 * Called for each token received
	 */
	onToken: (token: string, data: StreamToken) => void;

	/**
	 * Called for each reasoning token received (optional)
	 * If not provided, reasoning is still accumulated and available via return value
	 */
	onReasoning?: (reasoning: string, data: StreamToken) => void;

	/**
	 * Called when stream completes successfully
	 */
	onComplete: (metadata: StreamCompletion) => void;

	/**
	 * Called on stream error
	 */
	onError: (error: Error) => void;

	/**
	 * Initial cursor for resumption (optional)
	 */
	initialCursor?: string;

	/**
	 * Auto-reconnect on error (default: false)
	 */
	autoReconnect?: boolean;

	/**
	 * Max reconnection attempts (default: 3)
	 */
	maxReconnectAttempts?: number;

	/**
	 * Reconnect delay in ms (default: 1000)
	 */
	reconnectDelay?: number;
}

/**
 * Hook return value
 */
export interface UseStreamSubscriptionReturn {
	/**
	 * Current connection status
	 */
	status: StreamStatus;

	/**
	 * Current cursor position (for resumption)
	 */
	cursor: string;

	/**
	 * Accumulated text content from stream
	 */
	text: string;

	/**
	 * Accumulated reasoning content from stream
	 */
	reasoning: string;

	/**
	 * Manually reconnect to stream
	 */
	reconnect: () => void;

	/**
	 * Manually disconnect from stream
	 */
	disconnect: () => void;
}

/**
 * Hook for subscribing to SSE token streams
 */
export function useStreamSubscription({
	streamId,
	onToken,
	onReasoning,
	onComplete,
	onError,
	initialCursor = "0-0",
	autoReconnect = false,
	maxReconnectAttempts = 3,
	reconnectDelay = 1000,
}: UseStreamSubscriptionOptions): UseStreamSubscriptionReturn {
	const [status, setStatus] = useState<StreamStatus>("idle");
	const [text, setText] = useState<string>("");
	const [reasoning, setReasoning] = useState<string>("");
	const eventSourceRef = useRef<EventSource | null>(null);
	const cursorRef = useRef<string>(initialCursor);
	const reconnectAttemptsRef = useRef<number>(0);
	const isMountedRef = useRef<boolean>(true);

	// Stable callback refs to avoid reconnection on callback changes
	const onTokenRef = useRef(onToken);
	const onReasoningRef = useRef(onReasoning);
	const onCompleteRef = useRef(onComplete);
	const onErrorRef = useRef(onError);

	// Update refs on each render
	onTokenRef.current = onToken;
	onReasoningRef.current = onReasoning;
	onCompleteRef.current = onComplete;
	onErrorRef.current = onError;

	/**
	 * Disconnect from EventSource
	 */
	const disconnect = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
	}, []);

	/**
	 * Connect to stream
	 */
	const connect = useCallback(() => {
		if (!streamId || !isMountedRef.current) {
			return;
		}

		// Close existing connection
		disconnect();

		setStatus("connecting");

		const url = `/api/stream/${streamId}?cursor=${cursorRef.current}`;
		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			if (!isMountedRef.current) return;
			setStatus("connected");
			reconnectAttemptsRef.current = 0;
		};

		eventSource.onmessage = (event) => {
			if (!isMountedRef.current) return;

			try {
				const data = JSON.parse(event.data) as StreamToken;
				cursorRef.current = data.id;

				// Handle regular text delta
				if (data.delta) {
					setText((prev) => prev + data.delta);
					onTokenRef.current(data.delta, data);
				}

				// Handle reasoning content
				if (data.reasoning) {
					setReasoning((prev) => prev + data.reasoning);
					onReasoningRef.current?.(data.reasoning, data);
				}
			} catch (error) {
				console.error("[useStreamSubscription] Failed to parse message:", error);
			}
		};

		eventSource.addEventListener("complete", (event) => {
			if (!isMountedRef.current) return;

			try {
				const metadata = JSON.parse(
					(event as MessageEvent).data
				) as StreamCompletion;
				setStatus("complete");
				eventSource.close();
				onCompleteRef.current(metadata);
			} catch (error) {
				console.error(
					"[useStreamSubscription] Failed to parse completion:",
					error
				);
				setStatus("complete");
				eventSource.close();
				onCompleteRef.current({});
			}
		});

		eventSource.addEventListener("error", (event) => {
			if (!isMountedRef.current) return;

			// Try to parse error data if available
			let errorMessage = "Stream connection failed";
			try {
				const data = JSON.parse((event as MessageEvent).data);
				if (data.error) {
					errorMessage = data.error;
				}
			} catch {
				// No error data available
			}

			// Handle reconnection
			if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
				reconnectAttemptsRef.current++;
				eventSource.close();

				setTimeout(() => {
					if (isMountedRef.current) {
						connect();
					}
				}, reconnectDelay * reconnectAttemptsRef.current);
			} else {
				setStatus("error");
				eventSource.close();
				onErrorRef.current(new Error(errorMessage));
			}
		});

		// Handle browser-level EventSource error (connection failed)
		eventSource.onerror = () => {
			if (!isMountedRef.current) return;

			// EventSource already handles reconnection for temporary failures
			// Only handle permanent failures
			if (eventSource.readyState === EventSource.CLOSED) {
				if (
					autoReconnect &&
					reconnectAttemptsRef.current < maxReconnectAttempts
				) {
					reconnectAttemptsRef.current++;

					setTimeout(() => {
						if (isMountedRef.current) {
							connect();
						}
					}, reconnectDelay * reconnectAttemptsRef.current);
				} else {
					setStatus("error");
					onErrorRef.current(new Error("Stream connection closed"));
				}
			}
		};
	}, [
		streamId,
		disconnect,
		autoReconnect,
		maxReconnectAttempts,
		reconnectDelay,
	]);

	/**
	 * Manual reconnect function
	 */
	const reconnect = useCallback(() => {
		reconnectAttemptsRef.current = 0;
		connect();
	}, [connect]);

	// Auto-connect when streamId changes
	useEffect(() => {
		isMountedRef.current = true;

		if (streamId) {
			// Reset cursor and accumulated content when streamId changes (new stream)
			cursorRef.current = initialCursor;
			setText("");
			setReasoning("");
			connect();
		} else {
			setStatus("idle");
			setText("");
			setReasoning("");
			disconnect();
		}

		return () => {
			isMountedRef.current = false;
			disconnect();
		};
	}, [streamId, initialCursor, connect, disconnect]);

	return {
		status,
		cursor: cursorRef.current,
		text,
		reasoning,
		reconnect,
		disconnect,
	};
}
