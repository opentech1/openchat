import { describe, it, expect } from "bun:test";
import { appRouter } from "../src/routers";

describe("appRouter shape", () => {
	it("exposes chat procedures", () => {
		const { chats } = appRouter;
		expect(typeof chats.create.handler).toBe("function");
		expect(typeof chats.list.handler).toBe("function");
		expect(typeof chats.delete.handler).toBe("function");
	});
});
