import { describe, it, expect } from "bun:test";
import { appRouter } from "../src/routers";

describe("appRouter shape", () => {
	it("exposes chat procedures", () => {
		const { chats } = appRouter as any;
		const createMeta = chats.create?.["~orpc"] ?? null;
		const listMeta = chats.list?.["~orpc"] ?? null;
		const deleteMeta = chats.delete?.["~orpc"] ?? null;
		expect(typeof createMeta?.handler).toBe("function");
		expect(typeof listMeta?.handler).toBe("function");
		expect(typeof deleteMeta?.handler).toBe("function");
	});
});
