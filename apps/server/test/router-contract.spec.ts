import { describe, it, expect } from "bun:test";
import { appRouter } from "../src/routers";

describe("appRouter HTTP methods", () => {
	it("uses POST for invite mutations", () => {
		const { invite } = appRouter;
		expect(invite.reserve["~orpc"].route?.method).toBe("POST");
		expect(invite.release["~orpc"].route?.method).toBe("POST");
		expect(invite.consume["~orpc"].route?.method).toBe("POST");
		expect(invite.generate["~orpc"].route?.method).toBe("POST");
	});
});
