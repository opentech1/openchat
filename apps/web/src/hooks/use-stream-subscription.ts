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
	onComplete,
	onError,
	initialCursor = "0-0",
	autoReconnect = false,
	maxReconnectAttempts = 3,
	reconnectDelay = 1000,
}: UseStreamSubscriptionOptions): UseStreamSubscriptionReturn {
	const [status, setStatus] = useState<StreamStatus>("idle");
	const eventSourceRef = useRef<EventSource | null>(null);
	const cursorRef = useRef<string>(initialCursor);
	const reconnectAttemptsRef = useRef<number>(0);
	const isMountedRef = useRef<boolean>(true);

	// Stable callback refs to avoid reconnection on callback changes
	const onTokenRef = useRef(onToken);
	const onCompleteRef = useRef(onComplete);
	const onErrorRef = useRef(onError);

	// Update refs on each render
	onTokenRef.current = onToken;
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
		console.log("[useStreamSubscription] connect() called", { streamId, isMounted: isMountedRef.current });
		if (!streamId || !isMountedRef.current) {
			console.log("[useStreamSubscription] Skipping connect - no streamId or unmounted");
			return;
		}

		// Close existing connection
		disconnect();

		setStatus("connecting");

		const url = `/api/stream/${streamId}?cursor=${cursorRef.current}`;
		console.log("[useStreamSubscription] Creating EventSource", { url, cursor: cursorRef.current });
		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			console.log("[useStreamSubscription] EventSource opened", { readyState: eventSource.readyState });
			if (!isMountedRef.current) return;
			setStatus("connected");
			reconnectAttemptsRef.current = 0;
		};

		eventSource.onmessage = (event) => {
			console.log("[useStreamSubscription] Message received", { dataLength: event.data?.length, dataPreview: event.data?.substring(0, 100) });
			if (!isMountedRef.current) return;

			try {
				const data = JSON.parse(event.data) as StreamToken;
				cursorRef.current = data.id;
				console.log("[useStreamSubscription] Parsed token", { id: data.id, deltaLength: data.delta?.length, deltaPreview: data.delta?.substring(0, 30) });

				if (data.delta) {
					onTokenRef.current(data.delta, data);
				}
			} catch (error) {
				console.error("[useStreamSubscription] Failed to parse message:", error, { rawData: event.data });
			}
		};

		eventSource.addEventListener("complete", (event) => {
			console.log("[useStreamSubscription] Complete event received", { data: (event as MessageEvent).data });
			if (!isMountedRef.current) return;

			try {
				const metadata = JSON.parse(
					(event as MessageEvent).data
				) as StreamCompletion;
				console.log("[useStreamSubscription] Stream completed successfully", { metadata });
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
			console.log("[useStreamSubscription] Error event received", { type: event.type, data: (event as MessageEvent).data });
			if (!isMountedRef.current) return;

			// Try to parse error data if available
			let errorMessage = "Stream connection failed";
			try {
				const data = JSON.parse((event as MessageEvent).data);
				if (data.error) {
					errorMessage = data.error;
				}
				console.log("[useStreamSubscription] Parsed error", { errorMessage, data });
			} catch {
				// No error data available
				console.log("[useStreamSubscription] No parseable error data");
			}

			// Handle reconnection
			if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
				reconnectAttemptsRef.current++;
				console.warn(
					`[useStreamSubscription] Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
				);
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
		eventSource.onerror = (errorEvent) => {
			console.log("[useStreamSubscription] EventSource onerror", { readyState: eventSource.readyState, error: errorEvent });
			if (!isMountedRef.current) return;

			// EventSource already handles reconnection for temporary failures
			// Only handle permanent failures
			if (eventSource.readyState === EventSource.CLOSED) {
				console.log("[useStreamSubscription] EventSource CLOSED, attempting reconnect logic");
				if (
					autoReconnect &&
					reconnectAttemptsRef.current < maxReconnectAttempts
				) {
					reconnectAttemptsRef.current++;
					console.warn(
						`[useStreamSubscription] Connection closed, reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
					);

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
		console.log("[useStreamSubscription] useEffect triggered", { streamId, initialCursor });
		isMountedRef.current = true;

		if (streamId) {
			// Reset cursor when streamId changes (new stream)
			cursorRef.current = initialCursor;
			console.log("[useStreamSubscription] Calling connect for streamId", { streamId });
			connect();
		} else {
			console.log("[useStreamSubscription] No streamId, setting idle");
			setStatus("idle");
			disconnect();
		}

		return () => {
			console.log("[useStreamSubscription] Cleanup - unmounting", { streamId });
			isMountedRef.current = false;
			disconnect();
		};
	}, [streamId, initialCursor, connect, disconnect]);

	return {
		status,
		cursor: cursorRef.current,
		reconnect,
		disconnect,
	};
}
