"use client";

import { logError } from "@/lib/logger";

export type PrefetchMessage = {
	id: string;
	role: "assistant" | "user";
	content: string;
	createdAt: string;
};

export type PrefetchEntry = {
	messages: PrefetchMessage[];
	fetchedAt: number; // When data was fetched (for TTL expiration)
	lastAccessedAt: number; // When entry was last accessed (for LRU eviction)
};

const STORAGE_KEY = "openchat.chat-prefetch";
const DEFAULT_TTL_MS = Number(process.env.NEXT_PUBLIC_CHAT_PREFETCH_TTL_MS ?? 60_000);
const MAX_CACHE_SIZE = Number(process.env.NEXT_PUBLIC_CHAT_PREFETCH_MAX_SIZE ?? 50);

declare global {
	// eslint-disable-next-line no-var, vars-on-top
	var __OPENCHAT_CHAT_PREFETCH__:
		| {
				entries: Record<string, PrefetchEntry>;
				inflight: Record<string, Promise<PrefetchEntry | null> | undefined>;
		  }
		| undefined;
}

function getGlobalState() {
	if (!globalThis.__OPENCHAT_CHAT_PREFETCH__) {
		globalThis.__OPENCHAT_CHAT_PREFETCH__ = {
			entries: Object.create(null),
			inflight: Object.create(null),
		};
		if (typeof window !== "undefined") {
			try {
				const raw = window.sessionStorage?.getItem(STORAGE_KEY);
				if (raw) {
					const parsed = JSON.parse(raw) as Record<string, Partial<PrefetchEntry>>;
					// Migrate old cache entries that lack lastAccessedAt field
					const migrated: Record<string, PrefetchEntry> = {};
					for (const [chatId, entry] of Object.entries(parsed)) {
						if (entry.messages && typeof entry.fetchedAt === 'number') {
							migrated[chatId] = {
								messages: entry.messages,
								fetchedAt: entry.fetchedAt,
								// Use fetchedAt as fallback for old entries without lastAccessedAt
								lastAccessedAt: entry.lastAccessedAt ?? entry.fetchedAt,
							};
						}
					}
					globalThis.__OPENCHAT_CHAT_PREFETCH__.entries = migrated;
				}
			} catch {
				// ignore storage errors
			}
		}
	}
	return globalThis.__OPENCHAT_CHAT_PREFETCH__;
}

function persistEntries(entries: Record<string, PrefetchEntry>) {
	if (typeof window === "undefined" || !window.sessionStorage) return;
	try {
		window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	} catch {
		// ignore
	}
}

export function readChatPrefetch(chatId: string): PrefetchEntry | null {
	const { entries } = getGlobalState();
	const entry = entries[chatId];
	if (!entry) return null;

	// Check TTL expiration based on fetchedAt (when data was fetched)
	if (entry.fetchedAt + DEFAULT_TTL_MS < Date.now()) {
		delete entries[chatId];
		persistEntries(entries);
		return null;
	}

	// Update access time for LRU tracking without affecting TTL
	entry.lastAccessedAt = Date.now();
	persistEntries(entries);
	return entry;
}

export function storeChatPrefetch(chatId: string, messages: PrefetchMessage[]) {
	const state = getGlobalState();
	const now = Date.now();

	// Check if this is an update to an existing entry or a new entry
	const isUpdate = chatId in state.entries;

	// Enforce size limit before insertion to prevent overflow
	const currentEntries = Object.entries(state.entries);
	// Only remove entries if we're adding a new entry (not updating existing)
	if (!isUpdate && currentEntries.length >= MAX_CACHE_SIZE) {
		// Sort by lastAccessedAt ascending (least recently used first)
		currentEntries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
		// Remove least recently used entries to make room for the new entry
		const numToRemove = currentEntries.length - MAX_CACHE_SIZE + 1;
		const toRemove = currentEntries.slice(0, numToRemove);
		for (const [id] of toRemove) {
			delete state.entries[id];
		}
	}

	// Now insert or update the entry
	state.entries[chatId] = {
		messages,
		fetchedAt: now, // When data was fetched
		lastAccessedAt: now, // When entry was last accessed
	};

	persistEntries(state.entries);
}

export async function prefetchChat(chatId: string) {
	const state = getGlobalState();
	if (readChatPrefetch(chatId)) return;
	if (state.inflight[chatId]) {
		await state.inflight[chatId];
		return;
	}
	state.inflight[chatId] = (async () => {
		try {
			const response = await fetch(`/api/chats/${chatId}/prefetch`, {
				method: "GET",
				credentials: "include",
			});
			if (!response.ok) throw new Error("Prefetch failed");
			const payload = (await response.json()) as {
				ok: boolean;
				messages?: PrefetchMessage[];
			};
			if (!payload.ok || !payload.messages) throw new Error("Prefetch failed");
			const _now = Date.now();
			storeChatPrefetch(chatId, payload.messages);
			return { messages: payload.messages, fetchedAt: _now, lastAccessedAt: _now };
		} catch (error) {
			logError("Failed to prefetch chat", error);
			return null;
		} finally {
			delete state.inflight[chatId];
		}
	})();
	await state.inflight[chatId];
}
