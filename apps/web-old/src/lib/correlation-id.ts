/**
 * Request Correlation ID Utilities
 *
 * Helpers for working with request correlation IDs for distributed tracing.
 *
 * USAGE:
 * - Correlation IDs are set by middleware on all requests
 * - Use getCorrelationId(request) in API routes to get the ID
 * - Include correlation ID in all logs for that request
 * - Pass correlation ID to downstream services for end-to-end tracing
 *
 * BENEFITS:
 * - Trace a single request across multiple services
 * - Correlate logs from different parts of the system
 * - Debug production issues by following the request flow
 * - Measure end-to-end latency
 *
 * @example
 * ```typescript
 * // In API route
 * export async function POST(request: Request) {
 *   const correlationId = getCorrelationId(request);
 *
 *   logInfo("Processing request", { correlationId, data: "..." });
 *
 *   // Pass to downstream service
 *   await fetch("https://api.example.com/data", {
 *     headers: {
 *       "X-Request-ID": correlationId,
 *     },
 *   });
 * }
 * ```
 */

/**
 * Extract correlation ID from request headers
 *
 * @param request - The incoming request
 * @returns Correlation ID or "unknown" if not present
 */
export function getCorrelationId(request: Request): string {
	return request.headers.get("x-request-id") || "unknown";
}

/**
 * Create headers with correlation ID for downstream requests
 *
 * @param correlationId - The correlation ID to propagate
 * @param additionalHeaders - Any additional headers to include
 * @returns Headers object with correlation ID
 */
export function createCorrelatedHeaders(
	correlationId: string,
	additionalHeaders?: HeadersInit,
): HeadersInit {
	return {
		"X-Request-ID": correlationId,
		...additionalHeaders,
	};
}

/**
 * Async local storage for correlation ID (optional enhancement)
 *
 * This allows accessing the correlation ID anywhere in the request
 * lifecycle without passing it through function parameters.
 *
 * NOTE: This is an advanced pattern. For most use cases, explicitly
 * passing the correlation ID is clearer and easier to understand.
 */
import { AsyncLocalStorage } from "async_hooks";

type CorrelationContext = {
	requestId: string;
	startTime: number;
};

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Run a function with correlation context
 *
 * @param correlationId - The correlation ID for this request
 * @param fn - Function to run with context
 * @returns Result of the function
 */
export async function withCorrelationContext<T>(
	correlationId: string,
	fn: () => Promise<T>,
): Promise<T> {
	return correlationStorage.run(
		{
			requestId: correlationId,
			startTime: Date.now(),
		},
		fn,
	);
}

/**
 * Get the current correlation context
 *
 * @returns Correlation context or undefined if not in context
 */
export function getCorrelationContext(): CorrelationContext | undefined {
	return correlationStorage.getStore();
}

/**
 * Get the current request ID from context
 *
 * @returns Request ID or "unknown" if not in context
 */
export function getCurrentRequestId(): string {
	return getCorrelationContext()?.requestId || "unknown";
}

/**
 * Get elapsed time since request started
 *
 * @returns Elapsed time in milliseconds or 0 if not in context
 */
export function getElapsedTime(): number {
	const context = getCorrelationContext();
	if (!context) return 0;
	return Date.now() - context.startTime;
}
