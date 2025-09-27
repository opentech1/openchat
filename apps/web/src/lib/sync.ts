// Minimal single-socket sync client for /sync
// Envelope: { id, ts, topic, type, data }

export type Envelope<T = unknown> = {
	id: string;
	ts: number;
	topic: string;
	type: string;
	data: T;
};

type Handler = (event: Envelope) => void;

const handlers = new Map<string, Set<Handler>>();
let socket: WebSocket | null = null;
let connected = false;
let connecting = false;
let retry = 0;
let tabId: string = (typeof window !== "undefined" && (sessionStorage.getItem("oc_tab_id") || "")) || "";
if (typeof window !== "undefined" && !tabId) {
	tabId = crypto.randomUUID?.() || String(Date.now());
	try { sessionStorage.setItem("oc_tab_id", tabId); } catch {}
}

function wsBase(): string {
	const base = (process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");
	return base.startsWith("https") ? base.replace(/^https/, "wss") : base.replace(/^http/, "ws");
}

async function openSocket() {
	if (connected || connecting) return;
	connecting = true;
	const url = new URL(`${wsBase()}/sync`);
	url.searchParams.set("tabId", tabId);
	// In dev bypass mode, allow x-user-id via query param if the page set it
	try {
		const devUid = (window as any).__DEV_USER_ID__ as string | undefined;
		if (devUid) url.searchParams.set("x-user-id", devUid);
	} catch {}

	const ws = new WebSocket(url.toString());
	socket = ws;

	ws.onopen = () => {
		connected = true;
		connecting = false;
		retry = 0;
		// resubscribe current topics
		for (const [topic] of handlers) {
			ws.send(JSON.stringify({ op: "sub", topic }));
		}
	};
	ws.onmessage = (ev) => {
		if (typeof ev.data === "string") {
			if (ev.data === "pong" || ev.data === "unauthorized") return;
			try {
				const msg = JSON.parse(ev.data) as Envelope;
				const set = handlers.get(msg.topic);
				if (!set || set.size === 0) return;
				for (const fn of set) {
					try { fn(msg); } catch { /* ignore */ }
				}
			} catch {
				// ignore
			}
		}
	};
	ws.onclose = () => {
		connected = false;
		connecting = false;
		// exponential backoff up to ~5s
		retry = Math.min(retry + 1, 5);
		setTimeout(() => { if (!connected) void openSocket(); }, retry * 500);
	};
	ws.onerror = () => {
		try { ws.close(); } catch {}
	};
}

export async function connect() {
	await openSocket();
}

export function subscribe(topic: string, handler: Handler) {
	let set = handlers.get(topic);
	if (!set) {
		set = new Set<Handler>();
		handlers.set(topic, set);
		// first handler for this topic -> send sub
		if (socket && connected) {
			socket.send(JSON.stringify({ op: "sub", topic }));
		}
	}
	set.add(handler);
	// ensure socket is open
	void openSocket();
	return () => unsubscribe(topic, handler);
}

export function unsubscribe(topic: string, handler?: Handler) {
	const set = handlers.get(topic);
	if (!set) return;
	if (handler) set.delete(handler);
	if (set.size === 0) {
		handlers.delete(topic);
		if (socket && connected) {
			socket.send(JSON.stringify({ op: "unsub", topic }));
		}
	}
}

// Optional keepalive
export function ping() {
	if (socket && connected) socket.send("ping");
}

