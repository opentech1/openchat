/**
 * Server-Sent Events (SSE) route for streaming tokens to clients
 *
 * This endpoint reads from Redis stream and pushes tokens to connected clients
 * via SSE. It supports cursor-based resumption for reconnection scenarios.
 *
 * PROTOCOL:
 * - GET /api/stream/[id]?cursor=0-0
 * - Returns SSE stream with token events
 * - Sends keepalive comments every 15s
 * - Sends "complete" event when stream is finished
 *
 * SSE EVENT TYPES:
 * - data: Token data (JSON with id, delta, reasoning, etc.)
 * - complete: Stream finished (JSON with metadata)
 * - error: Stream error (JSON with error message)
 *
 * HEADERS:
 * - Content-Type: text/event-stream
 * - Cache-Control: no-cache, no-transform
 * - Connection: keep-alive
 * - X-Accel-Buffering: no (disable nginx buffering)
 */

import { redis, streamOps } from "@/lib/redis";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Maximum time to wait for new entries before checking completion (ms)
 */
const POLL_INTERVAL_MS = 50;

/**
 * Keepalive interval to prevent connection timeout (ms)
 */
const KEEPALIVE_INTERVAL_MS = 15000;

/**
 * Maximum stream duration before forced close (ms)
 * Prevents zombie connections
 */
const MAX_STREAM_DURATION_MS = 300000; // 5 minutes

/**
 * Prefix used by streaming.ts to mark reasoning tokens
 */
const REASONING_PREFIX = "[reasoning]";

/**
 * Parse a delta string to extract reasoning content if present
 * @param delta - Raw delta string from Redis stream
 * @returns Object with delta and optional reasoning fields
 */
function parseReasoningFromDelta(delta: string): {
	delta: string;
	reasoning?: string;
} {
	if (delta.startsWith(REASONING_PREFIX)) {
		return {
			delta: "",
			reasoning: delta.slice(REASONING_PREFIX.length),
		};
	}
	return { delta };
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	// Validate Redis is configured
	if (!redis.isConfigured()) {
		return new Response(
			JSON.stringify({ error: "Streaming not available" }),
			{
				status: 503,
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	const { id: streamId } = await params;
	const { searchParams } = new URL(request.url);
	const cursor = searchParams.get("cursor") || "0-0";

	// Validate streamId format (alphanumeric with dashes)
	if (!/^[a-z0-9-]+$/i.test(streamId)) {
		return new Response(
			JSON.stringify({ error: "Invalid stream ID format" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	const encoder = new TextEncoder();
	const startTime = Date.now();

	const stream = new ReadableStream({
		async start(controller) {
			let currentCursor = cursor;
			let keepAliveInterval: ReturnType<typeof setInterval> | undefined;
			let isComplete = false;

			// Helper to send SSE event
			const sendEvent = (
				eventType: string | null,
				data: Record<string, unknown>
			) => {
				try {
					if (eventType) {
						controller.enqueue(encoder.encode(`event: ${eventType}\n`));
					}
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
				} catch {
					// Controller may be closed
				}
			};

			// Send keepalive every 15s to prevent timeout
			keepAliveInterval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": keepalive\n\n"));
				} catch {
					// Controller may be closed
					if (keepAliveInterval) {
						clearInterval(keepAliveInterval);
					}
				}
			}, KEEPALIVE_INTERVAL_MS);

			try {
				while (!isComplete) {
					// Check if client disconnected
					if (request.signal.aborted) {
						break;
					}

					// Check max duration
					if (Date.now() - startTime > MAX_STREAM_DURATION_MS) {
						sendEvent("error", { error: "Stream timeout" });
						break;
					}

					// Read from Redis stream
					const result = await streamOps.readFromCursor(
						streamId,
						currentCursor,
						100
					);

					if (result.entries.length > 0) {
						for (const entry of result.entries) {
							// Parse reasoning prefix and send SSE event
							const parsed = parseReasoningFromDelta(entry.delta);
							sendEvent(null, {
								id: entry.id,
								delta: parsed.delta,
								...(parsed.reasoning && { reasoning: parsed.reasoning }),
								ts: entry.ts,
							});
							currentCursor = entry.id;
						}
					}

					// Check for stream completion
					const metadata = await streamOps.getMetadata(streamId);
					if (metadata) {
						if (metadata.status === "completed") {
							// Read any remaining entries
							const finalResult = await streamOps.readFromCursor(
								streamId,
								currentCursor,
								1000
							);
							for (const entry of finalResult.entries) {
								// Parse reasoning prefix and send SSE event
								const parsed = parseReasoningFromDelta(entry.delta);
								sendEvent(null, {
									id: entry.id,
									delta: parsed.delta,
									...(parsed.reasoning && { reasoning: parsed.reasoning }),
									ts: entry.ts,
								});
							}

							// Send completion event
							sendEvent("complete", {
								totalTokens: metadata.totalTokens,
								completedAt: metadata.completedAt,
							});
							isComplete = true;
							break;
						} else if (metadata.status === "error") {
							sendEvent("error", {
								error: metadata.error || "Stream error",
							});
							isComplete = true;
							break;
						}
					}

					// Small delay to prevent tight loop
					if (!isComplete) {
						await new Promise((resolve) =>
							setTimeout(resolve, POLL_INTERVAL_MS)
						);
					}
				}
			} catch (error) {
				// Send error event if possible
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				try {
					sendEvent("error", { error: errorMessage });
				} catch {
					// Controller may be closed
				}
			} finally {
				if (keepAliveInterval) {
					clearInterval(keepAliveInterval);
				}
				try {
					controller.close();
				} catch {
					// Controller may already be closed
				}
			}
		},

		cancel() {
			// Client disconnected - cleanup handled by finally block
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no", // Disable nginx buffering
		},
	});
}
