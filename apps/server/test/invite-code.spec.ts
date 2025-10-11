import { describe, it, expect } from "bun:test";
import { DEFAULT_CODE_LENGTH, generateInviteCode, hashInviteCode } from "../src/lib/invite";

const CODE_REGEX = /^[A-Z0-9]+$/;

describe("generateInviteCode", () => {
	it("produces codes of the expected length", () => {
		const code = generateInviteCode();
		expect(code.length).toBe(DEFAULT_CODE_LENGTH);
		expect(CODE_REGEX.test(code)).toBe(true);
	});

	it("produces unique codes across many generations", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 500; i += 1) {
			const code = generateInviteCode();
			expect(seen.has(code)).toBe(false);
			seen.add(code);
		}
	});

	it("hashes codes case-insensitively", () => {
		const code = generateInviteCode();
		expect(hashInviteCode(code)).toBe(hashInviteCode(code.toLowerCase()));
	});
});
