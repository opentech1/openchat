/**
 * Unit Tests for Metrics Collection
 *
 * Tests metrics collection utilities.
 */

import { describe, it, expect, beforeEach } from "vitest";

// Mock metrics implementation
class MetricsCollector {
	private metrics: Map<string, number> = new Map();

	increment(name: string, value = 1): void {
		const current = this.metrics.get(name) ?? 0;
		this.metrics.set(name, current + value);
	}

	gauge(name: string, value: number): void {
		this.metrics.set(name, value);
	}

	timing(name: string, ms: number): void {
		this.metrics.set(name, ms);
	}

	get(name: string): number | undefined {
		return this.metrics.get(name);
	}

	clear(): void {
		this.metrics.clear();
	}
}

describe("MetricsCollector", () => {
	let collector: MetricsCollector;

	beforeEach(() => {
		collector = new MetricsCollector();
	});

	describe("increment", () => {
		it("should increment counter", () => {
			// Act
			collector.increment("api.requests");
			collector.increment("api.requests");

			// Assert
			expect(collector.get("api.requests")).toBe(2);
		});

		it("should increment by custom value", () => {
			// Act
			collector.increment("api.bytes", 1024);

			// Assert
			expect(collector.get("api.bytes")).toBe(1024);
		});

		it("should start from zero", () => {
			// Act
			collector.increment("new.metric");

			// Assert
			expect(collector.get("new.metric")).toBe(1);
		});
	});

	describe("gauge", () => {
		it("should set gauge value", () => {
			// Act
			collector.gauge("memory.usage", 512);

			// Assert
			expect(collector.get("memory.usage")).toBe(512);
		});

		it("should overwrite previous value", () => {
			// Act
			collector.gauge("cpu.usage", 50);
			collector.gauge("cpu.usage", 75);

			// Assert
			expect(collector.get("cpu.usage")).toBe(75);
		});
	});

	describe("timing", () => {
		it("should record timing", () => {
			// Act
			collector.timing("api.latency", 125);

			// Assert
			expect(collector.get("api.latency")).toBe(125);
		});
	});

	describe("get", () => {
		it("should return undefined for non-existent metric", () => {
			// Act
			const value = collector.get("nonexistent");

			// Assert
			expect(value).toBeUndefined();
		});
	});

	describe("clear", () => {
		it("should clear all metrics", () => {
			// Arrange
			collector.increment("metric1");
			collector.gauge("metric2", 100);

			// Act
			collector.clear();

			// Assert
			expect(collector.get("metric1")).toBeUndefined();
			expect(collector.get("metric2")).toBeUndefined();
		});
	});
});
