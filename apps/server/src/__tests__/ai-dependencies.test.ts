import { describe, expect, test } from "bun:test";

import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

describe("ai sdk packages", () => {
	test("core exports exist", () => {
		expect(typeof streamText).toBe("function");
		expect(typeof createOpenRouter).toBe("function");
	});
});
