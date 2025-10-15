import { describe, it, expect } from "bun:test";
import { appRouter } from "../src/routers";

describe("appRouter shape", () => {
  it("exposes chat procedures", () => {
    const { chats } = appRouter;
    // The oRPC router exposes procedure descriptors (objects) consumed by RPCHandler
    expect(chats).toBeDefined();
    expect(Object.keys(chats)).toEqual(expect.arrayContaining(["create", "list", "delete"]));
    expect(typeof (chats as any).create).toBe("object");
    expect(typeof (chats as any).list).toBe("object");
    expect(typeof (chats as any).delete).toBe("object");
  });
});
