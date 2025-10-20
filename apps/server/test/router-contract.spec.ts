import { describe, it, expect } from "bun:test";
import { appRouter } from "../src/routers";

describe("appRouter shape", () => {
	it("exposes chat procedures", () => {
		const { chats } = appRouter;
		expect(typeof (chats.create as any).handler).toBe("function");
		expect(typeof (chats.list as any).handler).toBe("function");
		expect(typeof (chats.delete as any).handler).toBe("function");
	});
});
