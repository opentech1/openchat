import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveServerBaseUrls } from "../src/utils/server-url";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
	process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
});

describe("resolveServerBaseUrls", () => {
	it("prefers explicit internal URL when different from public", () => {
		process.env.SERVER_INTERNAL_URL = "http://internal:3000";
		process.env.NEXT_PUBLIC_SERVER_URL = "https://api.example.com";
		const result = resolveServerBaseUrls();
		expect(result.primary).toBe("http://internal:3000");
		expect(result.publicUrl).toBe("https://api.example.com");
	expect(result.fallback).toBe("http://localhost:3000");
	});

	it("falls back to container host when internal matches public", () => {
		process.env.NODE_ENV = "production";
		process.env.SERVER_INTERNAL_URL = "https://api.example.com";
		process.env.NEXT_PUBLIC_SERVER_URL = "https://api.example.com";
		const result = resolveServerBaseUrls();
		expect(result.primary).toBe("http://openchat-server:3000");
		expect(result.fallback).toBe("https://api.example.com");
	});

	it("defaults to localhost in development", () => {
		process.env.NODE_ENV = "development";
		delete process.env.SERVER_INTERNAL_URL;
		delete process.env.NEXT_PUBLIC_SERVER_URL;
		const result = resolveServerBaseUrls();
		expect(result.primary).toBe("http://localhost:3000");
	});
});
