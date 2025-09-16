import WebSocket from "ws";

export type WSClient = {
	ws: WebSocket;
	sub: (topic: string, handler: (event: any) => void) => void;
	waitFor: (predicate: (event: any) => boolean, timeoutMs?: number) => Promise<any>;
	close: () => Promise<void>;
};

export async function open(url: string, userId?: string, tabId?: string): Promise<WSClient> {
	const u = new URL(url);
	if (userId) u.searchParams.set("x-user-id", userId);
	if (tabId) u.searchParams.set("tabId", tabId);
	const ws = new WebSocket(u.toString());

	const handlers = new Map<string, Set<(event: any) => void>>();

	ws.on("message", (raw: WebSocket.RawData) => {
		try {
			const str = typeof raw === "string" ? raw : raw.toString();
			if (str === "pong" || str === "unauthorized") return;
			const msg = JSON.parse(str);
			const set = handlers.get(msg.topic);
			if (set) for (const fn of set) fn(msg);
		} catch {
			// ignore malformed payloads
		}
	});

	await new Promise<void>((resolve, reject) => {
		ws.once("open", () => resolve());
		ws.once("error", (error: Error) => reject(error));
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
		waitFor: (predicate, timeoutMs = 5000) =>
			new Promise((resolve, reject) => {
				const timer = setTimeout(() => {
					cleanup();
					reject(new Error("timeout"));
				}, timeoutMs);
				function onMsg(rawMessage: WebSocket.RawData) {
					try {
						const msg = JSON.parse(typeof rawMessage === "string" ? rawMessage : rawMessage.toString());
						if (predicate(msg)) {
							cleanup();
							return resolve(msg);
						}
					} catch {
						// ignore json parse errors
					}
				}
				function cleanup() {
					clearTimeout(timer);
					ws.off("message", onMsg);
				}
				ws.on("message", onMsg);
			}),
		close: async () => {
			try {
				ws.close();
			} catch {
				// ignore
			}
			await new Promise((resolve) => setTimeout(resolve, 50));
		},
	};
}
