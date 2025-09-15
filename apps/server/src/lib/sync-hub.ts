// Tiny in-memory pub/sub hub for WebSocket topics
// Topics (v1):
// - chats:index:{userId}
// - chat:{chatId}

export type Envelope<T = unknown> = {
	id: string;
	ts: number;
	topic: string;
	type: string;
	data: T;
};

type WS = {
	send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
	close: (code?: number, reason?: string) => void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[data: string]: any;
};

const topics = new Map<string, Set<WS>>();
const wsToTopics = new WeakMap<WS, Set<string>>();

const MAX_SUBS_PER_SOCKET = 50;
const MAX_EVENT_BYTES = 8 * 1024; // 8 KiB

function cuid() {
	try {
		return crypto.randomUUID();
	} catch {
		return Math.random().toString(36).slice(2) + Date.now().toString(36);
	}
}

export function makeEnvelope<T = unknown>(topic: string, type: string, data: T): Envelope<T> {
	return { id: cuid(), ts: Date.now(), topic, type, data };
}

export function subscribe(ws: WS, topic: string): { ok: boolean; reason?: string } {
	let set = wsToTopics.get(ws);
	if (!set) {
		set = new Set<string>();
		wsToTopics.set(ws, set);
	}
	if (!set.has(topic) && set.size >= MAX_SUBS_PER_SOCKET) {
		return { ok: false, reason: "too_many_subscriptions" };
	}
	set.add(topic);
	let sockets = topics.get(topic);
	if (!sockets) {
		sockets = new Set<WS>();
		topics.set(topic, sockets);
	}
	sockets.add(ws);
	return { ok: true };
}

export function unsubscribe(ws: WS, topic: string) {
	const set = wsToTopics.get(ws);
	set?.delete(topic);
	const sockets = topics.get(topic);
	sockets?.delete(ws);
	if (sockets && sockets.size === 0) topics.delete(topic);
}

export function unsubscribeAll(ws: WS) {
	const set = wsToTopics.get(ws);
	if (!set) return;
	for (const topic of set) {
		const sockets = topics.get(topic);
		sockets?.delete(ws);
		if (sockets && sockets.size === 0) topics.delete(topic);
	}
	wsToTopics.delete(ws);
}

export function publishEnvelope<T = unknown>(event: Envelope<T>) {
	const sockets = topics.get(event.topic);
	if (!sockets || sockets.size === 0) return;
	let payload: string;
	try {
		payload = JSON.stringify(event);
	} catch {
		return;
	}
	// Enforce max event size per socket
	if (payload.length > MAX_EVENT_BYTES) return;
	for (const ws of sockets) {
		try {
			ws.send(payload);
		} catch {
			// ignore broken socket; cleanup happens on close
		}
	}
}

export function publish<T = unknown>(topic: string, type: string, data: T) {
	publishEnvelope(makeEnvelope(topic, type, data));
}

export const hub = {
	subscribe,
	unsubscribe,
	unsubscribeAll,
	publish,
	publishEnvelope,
	makeEnvelope,
};

