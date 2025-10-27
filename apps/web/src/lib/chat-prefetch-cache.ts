"use client";

export type PrefetchMessage = {
	id: string;
	role: "assistant" | "user";
	content: string;
	createdAt: string;
};

export type PrefetchEntry = {
	messages: PrefetchMessage[];
	fetchedAt: number;
};

const STORAGE_KEY = "openchat.chat-prefetch";
const DEFAULT_TTL_MS = Number(process.env.NEXT_PUBLIC_CHAT_PREFETCH_TTL_MS ?? 60_000);

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
					const parsed = JSON.parse(raw) as Record<string, PrefetchEntry>;
					globalThis.__OPENCHAT_CHAT_PREFETCH__.entries = parsed;
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
	if (entry.fetchedAt + DEFAULT_TTL_MS < Date.now()) {
		delete entries[chatId];
		persistEntries(entries);
		return null;
	}
	return entry;
}

export function storeChatPrefetch(chatId: string, messages: PrefetchMessage[]) {
	const state = getGlobalState();
	state.entries[chatId] = {
		messages,
		fetchedAt: Date.now(),
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
			storeChatPrefetch(chatId, payload.messages);
			return { messages: payload.messages, fetchedAt: Date.now() };
		} catch (error) {
			console.error("prefetch chat", error);
			return null;
		} finally {
			delete state.inflight[chatId];
		}
	})();
	await state.inflight[chatId];
}
