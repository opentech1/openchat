"use client";

import type { ModelSelectorOption } from "@/components/model-selector";

const STORAGE_KEY = "openchat.openrouter.modelCache";
const DEFAULT_TTL_MS = Number(process.env.NEXT_PUBLIC_MODEL_CACHE_TTL_MS ?? 10 * 60 * 1000);

type CachedModels = {
	models: ModelSelectorOption[];
	expiresAt: number;
};

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
		const parsed = JSON.parse(raw) as CachedModels;
		if (!Array.isArray(parsed.models)) return null;
		if (typeof parsed.expiresAt !== "number") return null;
		if (parsed.expiresAt < Date.now()) {
			storage.removeItem(STORAGE_KEY);
			return null;
		}
		return parsed.models;
	} catch {
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
