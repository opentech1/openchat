/**
 * Metrics Collection
 *
 * Simple metrics collection for tracking application performance and usage.
 * Integrates with PostHog for event tracking and analytics.
 *
 * METRICS TRACKED:
 * - API response times
 * - Error rates
 * - Request counts
 * - Database query performance
 * - Cache hit rates
 *
 * USAGE:
 * - Call trackMetric() to record custom metrics
 * - Use withMetrics() wrapper for automatic timing
 * - Metrics are sent to PostHog for analysis
 * - In development, metrics are also logged to console
 */

import { getCorrelationId } from "./correlation-id";
import { logInfo } from "./logger-server";

/**
 * Metric types
 */
export type MetricType =
	| "api.response_time"
	| "api.error"
	| "api.request"
	| "db.query_time"
	| "cache.hit"
	| "cache.miss"
	| "auth.login"
	| "auth.logout"
	| "chat.create"
	| "chat.delete"
	| "message.send"
	| "custom";

/**
 * Metric data
 */
export type Metric = {
	/** Type of metric */
	type: MetricType;
	/** Metric name (e.g., "GET /api/chats") */
	name: string;
	/** Metric value (duration in ms, count, etc.) */
	value: number;
	/** Unit of measurement */
	unit: "ms" | "count" | "bytes" | "percent";
	/** Additional metadata */
	metadata?: Record<string, unknown>;
	/** Timestamp when metric was recorded */
	timestamp: number;
	/** Request correlation ID if available */
	correlationId?: string;
};

/**
 * Metrics store interface
 *
 * Allows swapping out the backend (PostHog, CloudWatch, Datadog, etc.)
 */
interface MetricsStore {
	track(metric: Metric): void | Promise<void>;
}

/**
 * Console metrics store (development)
 *
 * Logs metrics to console for debugging
 */
class ConsoleMetricsStore implements MetricsStore {
	track(metric: Metric): void {
		logInfo("Metric recorded", {
			type: metric.type,
			name: metric.name,
			value: metric.value,
			unit: metric.unit,
			metadata: metric.metadata,
		});
	}
}

/**
 * PostHog metrics store (production)
 *
 * Sends metrics to PostHog as events
 */
class PostHogMetricsStore implements MetricsStore {
	async track(metric: Metric): Promise<void> {
		// Only send if PostHog is enabled
		if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
			return;
		}

		try {
			// PostHog is client-side only, so we'll need to use their server SDK
			// or send via API for server-side metrics
			// For now, just log that we would send it
			if (process.env.NODE_ENV === "development") {
				console.log("[PostHog] Would send metric:", metric.type, metric.name, metric.value);
			}

			// TODO: Integrate with PostHog server SDK
			// const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY);
			// await posthog.capture({
			//   distinctId: metric.correlationId || "server",
			//   event: `metric.${metric.type}`,
			//   properties: {
			//     name: metric.name,
			//     value: metric.value,
			//     unit: metric.unit,
			//     ...metric.metadata,
			//   },
			// });
		} catch (error) {
			// Never let metrics collection break the application
			console.error("[Metrics] Failed to send to PostHog:", error);
		}
	}
}

/**
 * In-memory metrics aggregator
 *
 * Aggregates metrics in memory for quick access to recent stats.
 * Useful for health checks and admin dashboards.
 */
class MemoryMetricsAggregator {
	private metrics: Map<string, { count: number; sum: number; min: number; max: number }>;
	private maxMetrics = 1000; // Prevent memory leaks

	constructor() {
		this.metrics = new Map();
	}

	add(key: string, value: number): void {
		const existing = this.metrics.get(key);

		if (existing) {
			existing.count += 1;
			existing.sum += value;
			existing.min = Math.min(existing.min, value);
			existing.max = Math.max(existing.max, value);
		} else {
			// Don't add if we're at capacity
			if (this.metrics.size >= this.maxMetrics) {
				// Remove oldest entry (first in map)
				const firstKey = this.metrics.keys().next().value;
				if (firstKey !== undefined) {
					this.metrics.delete(firstKey);
				}
			}

			this.metrics.set(key, {
				count: 1,
				sum: value,
				min: value,
				max: value,
			});
		}
	}

	getStats(key: string): { count: number; avg: number; min: number; max: number } | null {
		const metric = this.metrics.get(key);
		if (!metric) return null;

		return {
			count: metric.count,
			avg: metric.sum / metric.count,
			min: metric.min,
			max: metric.max,
		};
	}

	getAllStats(): Map<string, { count: number; avg: number; min: number; max: number }> {
		const stats = new Map();
		for (const [key, metric] of this.metrics.entries()) {
			stats.set(key, {
				count: metric.count,
				avg: metric.sum / metric.count,
				min: metric.min,
				max: metric.max,
			});
		}
		return stats;
	}

	clear(): void {
		this.metrics.clear();
	}
}

// Singleton instances
const isDevelopment = process.env.NODE_ENV === "development";
let metricsStore: MetricsStore = isDevelopment
	? new ConsoleMetricsStore()
	: new PostHogMetricsStore();

const aggregator = new MemoryMetricsAggregator();

/**
 * Set custom metrics store
 *
 * @param store - Custom metrics store implementation
 */
export function setMetricsStore(store: MetricsStore): void {
	metricsStore = store;
}

/**
 * Track a metric
 *
 * @param metric - Metric data to track
 *
 * @example
 * ```typescript
 * trackMetric({
 *   type: "api.response_time",
 *   name: "GET /api/chats",
 *   value: 145,
 *   unit: "ms",
 *   metadata: { statusCode: 200 },
 * });
 * ```
 */
export async function trackMetric(metric: Omit<Metric, "timestamp">): Promise<void> {
	const fullMetric: Metric = {
		...metric,
		timestamp: Date.now(),
	};

	try {
		// Send to metrics store (async, non-blocking)
		void metricsStore.track(fullMetric);

		// Add to in-memory aggregator for quick stats
		const key = `${fullMetric.type}:${fullMetric.name}`;
		aggregator.add(key, fullMetric.value);
	} catch (error) {
		// Never let metrics tracking break the application
		console.error("[Metrics] Error tracking metric:", error);
	}
}

/**
 * Time a function and track the duration as a metric
 *
 * @param name - Name of the operation
 * @param type - Metric type (default: "custom")
 * @param fn - Function to time
 * @param metadata - Additional metadata to include
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await withMetrics(
 *   "fetch_user_data",
 *   "db.query_time",
 *   async () => {
 *     return await db.query(...);
 *   },
 *   { userId: "123" }
 * );
 * ```
 */
export async function withMetrics<T>(
	name: string,
	type: MetricType,
	fn: () => Promise<T>,
	metadata?: Record<string, unknown>,
): Promise<T> {
	const startTime = performance.now();

	try {
		const result = await fn();
		const duration = performance.now() - startTime;

		await trackMetric({
			type,
			name,
			value: duration,
			unit: "ms",
			metadata: {
				...metadata,
				success: true,
			},
		});

		return result;
	} catch (error) {
		const duration = performance.now() - startTime;

		await trackMetric({
			type: "api.error",
			name,
			value: duration,
			unit: "ms",
			metadata: {
				...metadata,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
		});

		throw error;
	}
}

/**
 * Track API request metrics
 *
 * @param request - The request object
 * @param response - The response object
 * @param duration - Request duration in milliseconds
 */
export async function trackApiRequest(
	request: Request,
	response: Response,
	duration: number,
): Promise<void> {
	const url = new URL(request.url);
	const correlationId = getCorrelationId(request);

	await trackMetric({
		type: "api.request",
		name: `${request.method} ${url.pathname}`,
		value: duration,
		unit: "ms",
		correlationId,
		metadata: {
			method: request.method,
			path: url.pathname,
			statusCode: response.status,
			success: response.ok,
		},
	});

	// Track errors separately
	if (!response.ok) {
		await trackMetric({
			type: "api.error",
			name: `${request.method} ${url.pathname}`,
			value: 1,
			unit: "count",
			correlationId,
			metadata: {
				statusCode: response.status,
			},
		});
	}
}

/**
 * Get aggregated metrics for a specific metric
 *
 * @param type - Metric type
 * @param name - Metric name
 * @returns Aggregated statistics or null if not found
 */
export function getMetricStats(
	type: MetricType,
	name: string,
): { count: number; avg: number; min: number; max: number } | null {
	const key = `${type}:${name}`;
	return aggregator.getStats(key);
}

/**
 * Get all aggregated metrics
 *
 * @returns Map of all aggregated statistics
 */
export function getAllMetricStats(): Map<string, { count: number; avg: number; min: number; max: number }> {
	return aggregator.getAllStats();
}

/**
 * Clear all aggregated metrics
 *
 * Useful for testing or resetting stats
 */
export function clearMetrics(): void {
	aggregator.clear();
}

/**
 * Middleware wrapper for automatic API metrics tracking
 *
 * @param request - The incoming request
 * @param handler - The actual route handler
 * @returns Response with metrics tracked
 *
 * @example
 * ```typescript
 * export async function GET(request: Request) {
 *   return withApiMetrics(request, async () => {
 *     // Your handler logic
 *     return NextResponse.json({ data: "..." });
 *   });
 * }
 * ```
 */
export async function withApiMetrics(
	request: Request,
	handler: () => Promise<Response>,
): Promise<Response> {
	const startTime = performance.now();

	try {
		const response = await handler();
		const duration = performance.now() - startTime;

		// Track metrics asynchronously (don't block response)
		void trackApiRequest(request, response, duration);

		return response;
	} catch (error) {
		const duration = performance.now() - startTime;

		// Track error metric
		const url = new URL(request.url);
		void trackMetric({
			type: "api.error",
			name: `${request.method} ${url.pathname}`,
			value: duration,
			unit: "ms",
			correlationId: getCorrelationId(request),
			metadata: {
				error: error instanceof Error ? error.message : "Unknown error",
			},
		});

		throw error;
	}
}
