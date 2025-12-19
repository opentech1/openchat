/**
 * Unit Tests for OpenRouter Model Cache
 *
 * Tests caching functionality for OpenRouter models:
 * - Cache model list
 * - Invalidate expired cache
 * - Hash-based cache validation
 * - Cache updates
 * - Storage error handling
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
	readCachedModels,
	writeCachedModels,
	clearCachedModels,
} from "@/lib/openrouter-model-cache";
import type { ModelSelectorOption } from "@/components/model-selector";

describe("openrouter-model-cache", () => {
	const mockModels: ModelSelectorOption[] = [
		{ value: "model-1", label: "Model 1" },
		{ value: "model-2", label: "Model 2" },
	];

	const STORAGE_KEY = "openchat.openrouter.modelCache";

	// Mock localStorage
	let storage: Record<string, string> = {};

	beforeEach(() => {
		storage = {};

		// Mock window and localStorage
		const mockStorage = {
			getItem: (key: string) => storage[key] || null,
			setItem: (key: string, value: string) => {
				storage[key] = value;
			},
			removeItem: (key: string) => {
				delete storage[key];
			},
		};

		// @ts-expect-error - mocking window
		global.window = {
			localStorage: mockStorage,
			sessionStorage: mockStorage,
		};
	});

	afterEach(() => {
		// Clean up
		// @ts-expect-error - cleanup
		delete global.window;
	});

	describe("writeCachedModels", () => {
		test("should write models to cache", () => {
			writeCachedModels(mockModels);

			const cached = storage[STORAGE_KEY];
			expect(cached).toBeDefined();
		});

		test("should store valid JSON", () => {
			writeCachedModels(mockModels);

			const cached = storage[STORAGE_KEY];
			expect(() => JSON.parse(cached)).not.toThrow();
		});

		test("should include models array", () => {
			writeCachedModels(mockModels);

			const parsed = JSON.parse(storage[STORAGE_KEY]);
			expect(parsed.models).toBeDefined();
			expect(Array.isArray(parsed.models)).toBe(true);
		});

		test("should include expiresAt timestamp", () => {
			writeCachedModels(mockModels);

			const parsed = JSON.parse(storage[STORAGE_KEY]);
			expect(parsed.expiresAt).toBeDefined();
			expect(typeof parsed.expiresAt).toBe("number");
		});

		test("should include hash", () => {
			writeCachedModels(mockModels);

			const parsed = JSON.parse(storage[STORAGE_KEY]);
			expect(parsed.hash).toBeDefined();
			expect(typeof parsed.hash).toBe("string");
		});

		test("should set expiry in the future", () => {
			const before = Date.now();
			writeCachedModels(mockModels);
			const after = Date.now();

			const parsed = JSON.parse(storage[STORAGE_KEY]);
			expect(parsed.expiresAt).toBeGreaterThan(after);
		});

		test("should preserve model data", () => {
			writeCachedModels(mockModels);

			const parsed = JSON.parse(storage[STORAGE_KEY]);
			expect(parsed.models).toEqual(mockModels);
		});

		test("should handle empty models array", () => {
			writeCachedModels([]);

			const parsed = JSON.parse(storage[STORAGE_KEY]);
			expect(parsed.models).toEqual([]);
		});

		test("should update existing cache with same data", () => {
			writeCachedModels(mockModels);
			const firstParse = JSON.parse(storage[STORAGE_KEY]);
			const firstExpiry = firstParse.expiresAt;

			// Wait a bit and write again
			writeCachedModels(mockModels);
			const secondParse = JSON.parse(storage[STORAGE_KEY]);

			expect(secondParse.expiresAt).toBeGreaterThanOrEqual(firstExpiry);
			expect(secondParse.hash).toBe(firstParse.hash);
		});

		test("should generate different hash for different data", () => {
			writeCachedModels(mockModels);
			const firstHash = JSON.parse(storage[STORAGE_KEY]).hash;

			const differentModels: ModelSelectorOption[] = [
				{ value: "model-3", label: "Model 3" },
			];
			writeCachedModels(differentModels);
			const secondHash = JSON.parse(storage[STORAGE_KEY]).hash;

			expect(firstHash).not.toBe(secondHash);
		});

		test("should handle models with special characters", () => {
			const specialModels: ModelSelectorOption[] = [
				{ value: "model/test", label: "Model: Test <>&\"'" },
			];

			writeCachedModels(specialModels);
			const parsed = JSON.parse(storage[STORAGE_KEY]);

			expect(parsed.models).toEqual(specialModels);
		});

		test("should handle large model arrays", () => {
			const largeArray: ModelSelectorOption[] = Array.from(
				{ length: 1000 },
				(_, i) => ({
					value: `model-${i}`,
					label: `Model ${i}`,
				})
			);

			writeCachedModels(largeArray);
			const parsed = JSON.parse(storage[STORAGE_KEY]);

			expect(parsed.models.length).toBe(1000);
		});
	});

	describe("readCachedModels", () => {
		test("should return null when cache is empty", () => {
			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should read cached models", () => {
			writeCachedModels(mockModels);
			const result = readCachedModels();

			expect(result).toEqual(mockModels);
		});

		test("should return null for expired cache", () => {
			const expiredCache = {
				models: mockModels,
				expiresAt: Date.now() - 1000, // Expired
				hash: "test-hash",
			};
			storage[STORAGE_KEY] = JSON.stringify(expiredCache);

			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should clear expired cache", () => {
			const expiredCache = {
				models: mockModels,
				expiresAt: Date.now() - 1000,
				hash: "test-hash",
			};
			storage[STORAGE_KEY] = JSON.stringify(expiredCache);

			readCachedModels();

			expect(storage[STORAGE_KEY]).toBeUndefined();
		});

		test("should return null for corrupted JSON", () => {
			storage[STORAGE_KEY] = "invalid json{";

			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should clear corrupted cache", () => {
			storage[STORAGE_KEY] = "invalid json{";

			readCachedModels();

			expect(storage[STORAGE_KEY]).toBeUndefined();
		});

		test("should return null for invalid cache structure", () => {
			storage[STORAGE_KEY] = JSON.stringify({ invalid: "structure" });

			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should clear invalid cache structure", () => {
			storage[STORAGE_KEY] = JSON.stringify({ invalid: "structure" });

			readCachedModels();

			expect(storage[STORAGE_KEY]).toBeUndefined();
		});

		test("should handle missing models field", () => {
			const invalidCache = {
				expiresAt: Date.now() + 10000,
				hash: "test-hash",
			};
			storage[STORAGE_KEY] = JSON.stringify(invalidCache);

			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should handle missing expiresAt field", () => {
			const invalidCache = {
				models: mockModels,
				hash: "test-hash",
			};
			storage[STORAGE_KEY] = JSON.stringify(invalidCache);

			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should handle missing hash field", () => {
			const invalidCache = {
				models: mockModels,
				expiresAt: Date.now() + 10000,
			};
			storage[STORAGE_KEY] = JSON.stringify(invalidCache);

			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should handle non-array models field", () => {
			const invalidCache = {
				models: "not an array",
				expiresAt: Date.now() + 10000,
				hash: "test-hash",
			};
			storage[STORAGE_KEY] = JSON.stringify(invalidCache);

			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should handle old cache format with version field", () => {
			const oldCache = {
				version: 1,
				models: mockModels,
				expiresAt: Date.now() + 10000,
			};
			storage[STORAGE_KEY] = JSON.stringify(oldCache);

			const result = readCachedModels();

			expect(result).toBeNull();
			expect(storage[STORAGE_KEY]).toBeUndefined();
		});

		test("should validate expiry only on read", () => {
			const futureExpiry = Date.now() + 100000;
			const cache = {
				models: mockModels,
				expiresAt: futureExpiry,
				hash: "test-hash",
			};
			storage[STORAGE_KEY] = JSON.stringify(cache);

			const result = readCachedModels();

			expect(result).toEqual(mockModels);
		});
	});

	describe("clearCachedModels", () => {
		test("should clear cache", () => {
			writeCachedModels(mockModels);
			expect(storage[STORAGE_KEY]).toBeDefined();

			clearCachedModels();

			expect(storage[STORAGE_KEY]).toBeUndefined();
		});

		test("should not error when cache is empty", () => {
			expect(() => clearCachedModels()).not.toThrow();
		});

		test("should handle multiple clear calls", () => {
			writeCachedModels(mockModels);

			clearCachedModels();
			clearCachedModels();
			clearCachedModels();

			expect(storage[STORAGE_KEY]).toBeUndefined();
		});
	});

	describe("hash-based cache validation", () => {
		test("should generate consistent hash for same data", () => {
			writeCachedModels(mockModels);
			const firstHash = JSON.parse(storage[STORAGE_KEY]).hash;

			clearCachedModels();
			writeCachedModels(mockModels);
			const secondHash = JSON.parse(storage[STORAGE_KEY]).hash;

			expect(firstHash).toBe(secondHash);
		});

		test("should generate different hash for different data", () => {
			writeCachedModels(mockModels);
			const firstHash = JSON.parse(storage[STORAGE_KEY]).hash;

			const differentModels: ModelSelectorOption[] = [
				{ value: "different", label: "Different" },
			];
			writeCachedModels(differentModels);
			const secondHash = JSON.parse(storage[STORAGE_KEY]).hash;

			expect(firstHash).not.toBe(secondHash);
		});

		test("should detect changes in model values", () => {
			writeCachedModels(mockModels);
			const firstHash = JSON.parse(storage[STORAGE_KEY]).hash;

			const changedModels: ModelSelectorOption[] = [
				{ value: "changed-1", label: "Model 1" },
				{ value: "model-2", label: "Model 2" },
			];
			writeCachedModels(changedModels);
			const secondHash = JSON.parse(storage[STORAGE_KEY]).hash;

			expect(firstHash).not.toBe(secondHash);
		});

		test("should detect changes in model labels", () => {
			writeCachedModels(mockModels);
			const firstHash = JSON.parse(storage[STORAGE_KEY]).hash;

			const changedModels: ModelSelectorOption[] = [
				{ value: "model-1", label: "Changed Label" },
				{ value: "model-2", label: "Model 2" },
			];
			writeCachedModels(changedModels);
			const secondHash = JSON.parse(storage[STORAGE_KEY]).hash;

			expect(firstHash).not.toBe(secondHash);
		});

		test("should detect changes in model order", () => {
			writeCachedModels(mockModels);
			const firstHash = JSON.parse(storage[STORAGE_KEY]).hash;

			const reorderedModels: ModelSelectorOption[] = [
				{ value: "model-2", label: "Model 2" },
				{ value: "model-1", label: "Model 1" },
			];
			writeCachedModels(reorderedModels);
			const secondHash = JSON.parse(storage[STORAGE_KEY]).hash;

			expect(firstHash).not.toBe(secondHash);
		});
	});

	describe("storage error handling", () => {
		test("should handle storage.getItem errors", () => {
			// @ts-expect-error - mocking window
			global.window = {
				localStorage: {
					getItem: () => {
						throw new Error("Storage error");
					},
					setItem: vi.fn(),
					removeItem: vi.fn(),
				},
			};

			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should handle storage.setItem errors", () => {
			// @ts-expect-error - mocking window
			global.window = {
				localStorage: {
					getItem: vi.fn(),
					setItem: () => {
						throw new Error("Storage full");
					},
					removeItem: vi.fn(),
				},
			};

			expect(() => writeCachedModels(mockModels)).not.toThrow();
		});

		test("should handle storage.removeItem errors", () => {
			// @ts-expect-error - mocking window
			global.window = {
				localStorage: {
					getItem: vi.fn(),
					setItem: vi.fn(),
					removeItem: () => {
						throw new Error("Remove error");
					},
				},
			};

			expect(() => clearCachedModels()).not.toThrow();
		});

		test("should handle missing localStorage", () => {
			// @ts-expect-error - mocking window
			delete global.window;

			const result = readCachedModels();

			expect(result).toBeNull();
		});

		test("should handle null localStorage", () => {
			// @ts-expect-error - mocking window
			global.window = {
				localStorage: null,
			};

			const result = readCachedModels();

			expect(result).toBeNull();
		});
	});

	describe("integration tests", () => {
		test("should support full write-read-clear cycle", () => {
			writeCachedModels(mockModels);
			const read1 = readCachedModels();
			expect(read1).toEqual(mockModels);

			clearCachedModels();
			const read2 = readCachedModels();
			expect(read2).toBeNull();
		});

		test("should support multiple write-read cycles", () => {
			writeCachedModels(mockModels);
			expect(readCachedModels()).toEqual(mockModels);

			const newModels: ModelSelectorOption[] = [
				{ value: "new-model", label: "New Model" },
			];
			writeCachedModels(newModels);
			expect(readCachedModels()).toEqual(newModels);
		});

		test("should handle rapid consecutive writes", () => {
			writeCachedModels(mockModels);
			writeCachedModels(mockModels);
			writeCachedModels(mockModels);

			const result = readCachedModels();

			expect(result).toEqual(mockModels);
		});

		test("should preserve data integrity across operations", () => {
			const complexModels: ModelSelectorOption[] = [
				{ value: "model/with/slashes", label: "Model: Special <>&\"'" },
				{ value: "unicode-模型", label: "Unicode 测试 🎉" },
			];

			writeCachedModels(complexModels);
			const result = readCachedModels();

			expect(result).toEqual(complexModels);
		});
	});
});
