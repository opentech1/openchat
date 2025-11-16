"use client";

import type { ModelSelectorOption } from "@/components/model-selector";

const STORAGE_KEY = "openchat.openrouter.modelCache";
const DEFAULT_TTL_MS = Number(process.env.NEXT_PUBLIC_MODEL_CACHE_TTL_MS ?? 10 * 60 * 1000);
const CACHE_VERSION = 8; // Increment this to invalidate old caches

type CachedModels = {
	models: ModelSelectorOption[];
	expiresAt: number;
	version: number;
};

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
		"version" in value &&
		typeof (value as any).version === "number"
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
		} catch (error) {
			// Invalid JSON - clear corrupted cache and return null
			storage.removeItem(STORAGE_KEY);
			return null;
		}

		// Validate structure with type guard
		if (!isCachedModels(parsed)) {
			// Invalid structure - clear corrupted cache and return null
			storage.removeItem(STORAGE_KEY);
			return null;
		}

		// Validate version and expiry
		if (parsed.version !== CACHE_VERSION) {
			storage.removeItem(STORAGE_KEY);
			return null;
		}

		if (parsed.expiresAt < Date.now()) {
			storage.removeItem(STORAGE_KEY);
			return null;
		}

		return parsed.models;
	} catch (error) {
		// Catch any other unexpected errors
		return null;
	}
}

export function writeCachedModels(models: ModelSelectorOption[]) {
	const storage = getStorage();
	if (!storage) return;
	try {
		const payload: CachedModels = {
			models,
			expiresAt: Date.now() + DEFAULT_TTL_MS,
			version: CACHE_VERSION,
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
