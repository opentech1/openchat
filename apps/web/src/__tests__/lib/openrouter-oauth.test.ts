/**
 * Unit tests for OpenRouter OAuth PKCE utilities
 */

import {
  generateCodeVerifier,
  generateCodeChallenge,
} from "../openrouter-oauth";

describe("OpenRouter OAuth PKCE Utilities", () => {
  describe("generateCodeVerifier", () => {
    it("generates a code verifier", () => {
      const verifier = generateCodeVerifier();

      // Should be a non-empty string
      expect(verifier).toBeTruthy();
      expect(typeof verifier).toBe("string");

      // Should be base64url encoded (only contains A-Z, a-z, 0-9, -, _)
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);

      // Should be 43 characters (32 bytes base64url encoded)
      expect(verifier.length).toBe(43);
    });

    it("generates unique verifiers on each call", () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      // Should be different on each call
      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe("generateCodeChallenge", () => {
    it("generates a code challenge from a verifier", async () => {
      const verifier = "test-verifier-string";
      const challenge = await generateCodeChallenge(verifier);

      // Should be a non-empty string
      expect(challenge).toBeTruthy();
      expect(typeof challenge).toBe("string");

      // Should be base64url encoded
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);

      // SHA-256 hash is 32 bytes, base64url encoded is 43 characters
      expect(challenge.length).toBe(43);
    });

    it("generates consistent challenge for same verifier", async () => {
      const verifier = "consistent-test-verifier";
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);

      // Should generate the same challenge for the same verifier
      expect(challenge1).toBe(challenge2);
    });

    it("generates different challenges for different verifiers", async () => {
      const verifier1 = "verifier-one";
      const verifier2 = "verifier-two";

      const challenge1 = await generateCodeChallenge(verifier1);
      const challenge2 = await generateCodeChallenge(verifier2);

      // Should generate different challenges for different verifiers
      expect(challenge1).not.toBe(challenge2);
    });

    it("generates known challenge for known verifier", async () => {
      // Test with a known verifier to ensure correct SHA-256 implementation
      // Verifier: "test"
      // Expected SHA-256: "n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg" (base64url)
      const verifier = "test";
      const challenge = await generateCodeChallenge(verifier);

      // Verify the challenge is correctly computed
      expect(challenge).toBe("n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg");
    });
  });

  describe("base64url encoding", () => {
    it("does not contain + or / or =", async () => {
      // Generate many challenges to test base64url encoding
      for (let i = 0; i < 100; i++) {
        const verifier = generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);

        // base64url should not contain +, /, or =
        expect(challenge).not.toContain("+");
        expect(challenge).not.toContain("/");
        expect(challenge).not.toContain("=");

        // Should only contain base64url characters
        expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });
  });

  describe("PKCE flow integration", () => {
    it("generates valid verifier and challenge pair", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      // Both should be valid base64url strings
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);

      // Both should be 43 characters (32 bytes encoded)
      expect(verifier.length).toBe(43);
      expect(challenge.length).toBe(43);

      // Verifier and challenge should be different
      expect(verifier).not.toBe(challenge);
    });
  });
});
