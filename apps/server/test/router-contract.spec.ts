import { describe, it, expect } from "bun:test";
import { appRouter } from "../src/routers";

describe("appRouter shape", () => {
	it("exposes chat procedures", () => {
		const { chats } = appRouter;
		expect(Reflect.has(chats.create, "handler")).toBe(true);
		expect(typeof Reflect.get(chats.create, "handler")).toBe("function");
		expect(Reflect.has(chats.list, "handler")).toBe(true);
		expect(typeof Reflect.get(chats.list, "handler")).toBe("function");
		expect(Reflect.has(chats.delete, "handler")).toBe(true);
		expect(typeof Reflect.get(chats.delete, "handler")).toBe("function");
	});
});
