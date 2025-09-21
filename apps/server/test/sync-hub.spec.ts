import { describe, it, expect } from "vitest";
import { hub } from "../src/lib/sync-hub";

function makeWS() {
	const sent: string[] = [];
	return {
		sent,
		send: (data: any) => {
			sent.push(String(data));
		},
		close: () => {},
	} as any;
}

describe("sync-hub", () => {
	it("subscribe/unsubscribe adds/removes sockets", () => {
		const ws = makeWS();
		const res = hub.subscribe(ws, "topic:a");
		expect(res.ok).toBe(true);
		hub.publish("topic:a", "t", {});
		expect(ws.sent.length).toBe(1);
		hub.unsubscribe(ws, "topic:a");
		hub.publish("topic:a", "t", {});
		expect(ws.sent.length).toBe(1);
	});

	it("publish only reaches subscribed sockets", () => {
		const a = makeWS();
		const b = makeWS();
		hub.subscribe(a, "X");
		hub.subscribe(b, "Y");
		hub.publish("X", "test", { x: 1 });
		expect(a.sent.length).toBe(1);
		expect(b.sent.length).toBe(0);
	});

	it("enforces max subscriptions per socket", () => {
		const ws = makeWS();
		for (let i = 0; i < 50; i++) {
			expect(hub.subscribe(ws, `t:${i}`).ok).toBe(true);
		}
		const r = hub.subscribe(ws, "t:overflow");
		expect(r.ok).toBe(false);
		expect(r.reason).toBe("too_many_subscriptions");
	});

	it("enforces ~8KB payload cap", () => {
		const ws = makeWS();
		hub.subscribe(ws, "t");
		const big = "x".repeat(9 * 1024);
		hub.publish("t", "big", big);
		expect(ws.sent.length).toBe(0);
	});

	it("unsubscribeAll cleans internal maps", () => {
		const ws = makeWS();
		hub.subscribe(ws, "a");
		hub.subscribe(ws, "b");
		hub.unsubscribeAll(ws);
		// Try publishing; nothing should be sent
		hub.publish("a", "x", {});
		hub.publish("b", "x", {});
		expect(ws.sent.length).toBe(0);
	});
});
