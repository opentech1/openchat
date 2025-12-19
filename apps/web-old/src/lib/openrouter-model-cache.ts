"use client";

import type { ModelSelectorOption } from "@/components/model-selector";

const STORAGE_KEY = "openchat.openrouter.modelCache";
const DEFAULT_TTL_MS = Number(process.env.NEXT_PUBLIC_MODEL_CACHE_TTL_MS ?? 10 * 60 * 1000);

type CachedModels = {
	models: ModelSelectorOption[];
	expiresAt: number;
	hash: string;
};

/**
 * Simple hash function for cache invalidation
 * Only invalidates when actual model data changes
 */
function hashModels(models: ModelSelectorOption[]): string {
	const key = models.map(m => `${m.value}:${m.label}`).join(',');
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		const char = key.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash.toString(36);
}

/**
 * Type guard to validate cache structure
 * Prevents app crashes from corrupted localStorage data
 */
function isCachedModels(value: unknown): value is CachedModels {
	return (
		typeof value === "object" &&
		value !== null &&
		"models" in value &&
		Array.isArray((value as any).models) &&
		"expiresAt" in value &&
		typeof (value as any).expiresAt === "number" &&
		"hash" in value &&
		typeof (value as any).hash === "string"
	);
}

function getStorage() {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage ?? window.sessionStorage ?? null;
	} catch {
		return null;
	}
}

export function readCachedModels(): ModelSelectorOption[] | null {
	const storage = getStorage();
	if (!storage) return null;

	try {
		const raw = storage.getItem(STORAGE_KEY);
		if (!raw) return null;

		// Parse with try-catch to handle corrupted JSON
		let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (_error) {
		// Invalid JSON - clear corrupted cache and return null
		storage.removeItem(STORAGE_KEY);
		return null;
	}

		// Check for old cache format (with version field) and clear it
		if (parsed && typeof parsed === 'object' && 'version' in parsed) {
			storage.removeItem(STORAGE_KEY);
			return null;
		}

		// Validate structure with type guard
		if (!isCachedModels(parsed)) {
			// Invalid structure - clear corrupted cache and return null
			storage.removeItem(STORAGE_KEY);
			return null;
		}

		// Validate expiry only - hash will be checked when writing
		if (parsed.expiresAt < Date.now()) {
			storage.removeItem(STORAGE_KEY);
			return null;
		}

	return parsed.models;
} catch (_error) {
	// Catch any other unexpected errors
	return null;
}
}

export function writeCachedModels(models: ModelSelectorOption[]) {
	const storage = getStorage();
	if (!storage) return;
	try {
		const newHash = hashModels(models);

		// Check if we already have this exact data cached
		const existing = storage.getItem(STORAGE_KEY);
		if (existing) {
			try {
				const parsed = JSON.parse(existing);
				if (isCachedModels(parsed) && parsed.hash === newHash) {
					// Same data, just update expiry
					parsed.expiresAt = Date.now() + DEFAULT_TTL_MS;
					storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
					return;
				}
			} catch {
				// Corrupted, will overwrite below
			}
		}

		// New or changed data, write it
		const payload: CachedModels = {
			models,
			expiresAt: Date.now() + DEFAULT_TTL_MS,
			hash: newHash,
		};
		storage.setItem(STORAGE_KEY, JSON.stringify(payload));
	} catch {
		// ignore storage failures
	}
}

export function clearCachedModels() {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
