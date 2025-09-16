import { describe, expect, it } from "vitest";

import { useChat } from "@ai-sdk/react";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createCollection } from "@tanstack/react-db";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { ShapeStream } from "@electric-sql/client";
import { useShape } from "@electric-sql/react";

describe("phase 0 dependencies", () => {
	it("exposes expected exports", () => {
		expect(typeof useChat).toBe("function");
		expect(typeof streamText).toBe("function");
		expect(typeof createOpenRouter).toBe("function");
		expect(typeof createCollection).toBe("function");
		expect(typeof electricCollectionOptions).toBe("function");
		expect(typeof ShapeStream).toBe("function");
		expect(typeof useShape).toBe("function");
	});
});
