/**
 * Polyfills for better-auth to work in Convex environment
 * Source: https://github.com/get-convex/better-auth/blob/main/examples/next/convex/polyfills.ts
 */

// polyfill MessageChannel without using node:events
class MockMessagePort {
	onmessage: ((this: MessagePort, ev: MessageEvent) => any) | null = null;
	onmessageerror: ((this: MessagePort, ev: MessageEvent) => any) | null = null;

	close() {}
	postMessage(_message: any) {}
	start() {}
	addEventListener() {}
	removeEventListener() {}
	dispatchEvent(_event: Event): boolean {
		return true;
	}
}

class MockMessageChannel {
	port1 = new MockMessagePort();
	port2 = new MockMessagePort();
}

if (typeof MessageChannel === "undefined") {
	(globalThis as any).MessageChannel = MockMessageChannel;
}
