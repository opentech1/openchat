import WebSocket from "ws";

export type WSClient = {
	ws: WebSocket;
	sub: (topic: string, handler: (e: any) => void) => void;
	waitFor: (predicate: (e: any) => boolean, timeoutMs?: number) => Promise<any>;
	close: () => Promise<void>;
};

export async function open(url: string, userId?: string, tabId?: string): Promise<WSClient> {
	const u = new URL(url);
	if (userId) u.searchParams.set("x-user-id", userId);
	if (tabId) u.searchParams.set("tabId", tabId);
	const ws = new WebSocket(u.toString());

	const handlers = new Map<string, Set<(e: any) => void>>();

	ws.on("message", (raw) => {
		try {
			const str = typeof raw === "string" ? raw : raw.toString();
			if (str === "pong" || str === "unauthorized") return;
			const msg = JSON.parse(str);
			const set = handlers.get(msg.topic);
			if (set) for (const fn of set) fn(msg);
		} catch {}
	});

	await new Promise<void>((resolve, reject) => {
		ws.once("open", () => resolve());
		ws.once("error", (e) => reject(e));
		ws.once("close", () => reject(new Error("closed")));
	});

	return {
		ws,
		sub: (topic, handler) => {
			let set = handlers.get(topic);
			if (!set) {
				set = new Set();
				handlers.set(topic, set);
				ws.send(JSON.stringify({ op: "sub", topic }));
			}
			set.add(handler);
		},
		waitFor: (predicate, timeoutMs = 5000) => {
			return new Promise((resolve, reject) => {
				const timer = setTimeout(() => {
					cleanup();
					reject(new Error("timeout"));
				}, timeoutMs);
				function onMsg(raw: WebSocket.RawData) {
					try {
						const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
						if (predicate(msg)) {
							cleanup();
							return resolve(msg);
						}
					} catch {}
				}
				function cleanup() {
					clearTimeout(timer);
					ws.off("message", onMsg);
				}
				ws.on("message", onMsg);
			});
		},
		close: async () => {
			try { ws.close(); } catch {}
			await new Promise((r) => setTimeout(r, 50));
		},
	};
}

