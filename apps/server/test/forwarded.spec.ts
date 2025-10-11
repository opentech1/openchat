import { describe, it, expect } from "bun:test";
import { extractForwardedToken, parseForwardedHeader } from "../src/lib/forwarded";

describe("forwarded header parsing", () => {
	it("extracts IPv4 from Forwarded syntax", () => {
		expect(parseForwardedHeader("for=192.0.2.60")).toBe("192.0.2.60");
		expect(parseForwardedHeader(" for=192.0.2.60;proto=https"))
			.toBe("192.0.2.60");
	});

	it("extracts IPv6 with brackets and port", () => {
		expect(parseForwardedHeader("for=\"[2001:db8::1]:443\"")).toBe("2001:db8::1");
	});

	it("extracts first value from x-forwarded-for style list", () => {
		expect(parseForwardedHeader("203.0.113.1, 70.41.3.18")).toBe("203.0.113.1");
	});

	it("ignores invalid tokens", () => {
		expect(extractForwardedToken("for=unknown"))
			.toBe("unknown");
		expect(parseForwardedHeader("for=unknown"))
			.toBeNull();
	});
});
