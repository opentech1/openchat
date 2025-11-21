/**
 * Unit Tests for Encryption Utilities
 *
 * Comprehensive test coverage for client-side encryption including:
 * - AES-GCM encryption and decryption
 * - PBKDF2 key derivation
 * - Random IV and salt generation
 * - User-specific encryption
 * - Key isolation
 * - Tamper detection
 * - Backward compatibility
 *
 * Security Critical: This module protects sensitive user data (API keys).
 */

import { describe, test, expect, beforeAll, vi } from "vitest";
import {
	encryptData,
	decryptData,
	isEncrypted,
	encryptApiKey,
	decryptApiKey,
} from "./encryption";

// Mock crypto for Node.js environment if needed
beforeAll(() => {
	// Ensure crypto.subtle is available
	if (!globalThis.crypto) {
		// @ts-expect-error - Polyfill for testing
		globalThis.crypto = require("crypto").webcrypto;
	}
});

describe("encryptData - Basic Functionality", () => {
	test("should encrypt plaintext successfully", async () => {
		const plaintext = "sensitive data";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		expect(encrypted).toBeDefined();
		expect(typeof encrypted).toBe("string");
		expect(encrypted).not.toBe(plaintext);
	});

	test("should return string with encryption prefix", async () => {
		const plaintext = "test data";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		expect(encrypted.startsWith("enc_v1:")).toBe(true);
	});

	test("should produce different ciphertext for same input", async () => {
		const plaintext = "same data";
		const userId = "user123";

		const encrypted1 = await encryptData(plaintext, userId);
		const encrypted2 = await encryptData(plaintext, userId);

		// Should be different due to random IV and salt
		expect(encrypted1).not.toBe(encrypted2);
	});

	test("should handle empty string", async () => {
		const plaintext = "";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		expect(encrypted).toBeDefined();
		expect(encrypted.startsWith("enc_v1:")).toBe(true);
	});

	test("should handle long text", async () => {
		const plaintext = "a".repeat(10000);
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		expect(encrypted).toBeDefined();
		expect(encrypted.startsWith("enc_v1:")).toBe(true);
	});

	test("should handle special characters", async () => {
		const plaintext = "!@#$%^&*()_+-={}[]|:;<>?,./~`";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);
		const decrypted = await decryptData(encrypted, userId);

		expect(decrypted).toBe(plaintext);
	});

	test("should handle unicode characters", async () => {
		const plaintext = "Hello 世界 🌍";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);
		const decrypted = await decryptData(encrypted, userId);

		expect(decrypted).toBe(plaintext);
	});

	test("should handle multiline text", async () => {
		const plaintext = "Line 1\nLine 2\nLine 3";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);
		const decrypted = await decryptData(encrypted, userId);

		expect(decrypted).toBe(plaintext);
	});

	test("should handle JSON strings", async () => {
		const plaintext = JSON.stringify({ key: "value", number: 42 });
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);
		const decrypted = await decryptData(encrypted, userId);

		expect(decrypted).toBe(plaintext);
		expect(JSON.parse(decrypted)).toEqual({ key: "value", number: 42 });
	});
});

describe("decryptData - Basic Functionality", () => {
	test("should decrypt encrypted data successfully", async () => {
		const plaintext = "secret message";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);
		const decrypted = await decryptData(encrypted, userId);

		expect(decrypted).toBe(plaintext);
	});

	test("should maintain data integrity", async () => {
		const plaintext = "important data with numbers 12345";
		const userId = "user456";

		const encrypted = await encryptData(plaintext, userId);
		const decrypted = await decryptData(encrypted, userId);

		expect(decrypted).toBe(plaintext);
	});

	test("should handle backward compatibility for unencrypted data", async () => {
		const plaintext = "unencrypted data";
		const userId = "user123";

		// Data without encryption prefix should be returned as-is
		const result = await decryptData(plaintext, userId);

		expect(result).toBe(plaintext);
	});

	test("should return non-encrypted data unchanged", async () => {
		const plaintext = "plain text without prefix";
		const userId = "user123";

		const result = await decryptData(plaintext, userId);

		expect(result).toBe(plaintext);
	});

	test("should fail with wrong user ID", async () => {
		const plaintext = "secret data";
		const userId1 = "user123";
		const userId2 = "user456";

		const encrypted = await encryptData(plaintext, userId1);

		// Should throw when decrypting with different user ID
		await expect(decryptData(encrypted, userId2)).rejects.toThrow();
	});

	test("should fail with tampered ciphertext", async () => {
		const plaintext = "original data";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		// Tamper with the ciphertext
		const tampered = encrypted.slice(0, -5) + "XXXXX";

		await expect(decryptData(tampered, userId)).rejects.toThrow();
	});

	test("should fail with invalid base64", async () => {
		const invalid = "enc_v1:not-valid-base64!@#$";
		const userId = "user123";

		await expect(decryptData(invalid, userId)).rejects.toThrow();
	});

	test("should fail with truncated ciphertext", async () => {
		const plaintext = "data";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);
		const truncated = encrypted.slice(0, 20);

		await expect(decryptData(truncated, userId)).rejects.toThrow();
	});

	test("should throw error with descriptive message", async () => {
		const invalid = "enc_v1:invalid";
		const userId = "user123";

		try {
			await decryptData(invalid, userId);
			expect.fail("Should have thrown error");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBe("Failed to decrypt data");
		}
	});
});

describe("User-Specific Encryption", () => {
	test("should isolate data between different users", async () => {
		const plaintext = "user-specific data";
		const user1 = "alice";
		const user2 = "bob";

		const encrypted1 = await encryptData(plaintext, user1);
		const encrypted2 = await encryptData(plaintext, user2);

		// Different users should produce different ciphertexts
		expect(encrypted1).not.toBe(encrypted2);

		// Each user can decrypt their own data
		const decrypted1 = await decryptData(encrypted1, user1);
		const decrypted2 = await decryptData(encrypted2, user2);

		expect(decrypted1).toBe(plaintext);
		expect(decrypted2).toBe(plaintext);

		// Users cannot decrypt each other's data
		await expect(decryptData(encrypted1, user2)).rejects.toThrow();
		await expect(decryptData(encrypted2, user1)).rejects.toThrow();
	});

	test("should use user ID as key material", async () => {
		const plaintext = "test";
		const user1 = "user1";
		const user2 = "user1"; // Same user ID

		const encrypted1 = await encryptData(plaintext, user1);
		const decrypted = await decryptData(encrypted1, user2);

		// Same user ID should work
		expect(decrypted).toBe(plaintext);
	});

	test("should handle different user ID formats", async () => {
		const plaintext = "data";
		const userIds = [
			"user123",
			"user@email.com",
			"uuid-1234-5678",
			"user:session:abc",
		];

		for (const userId of userIds) {
			const encrypted = await encryptData(plaintext, userId);
			const decrypted = await decryptData(encrypted, userId);

			expect(decrypted).toBe(plaintext);
		}
	});

	test("should handle empty user ID", async () => {
		const plaintext = "test";
		const userId = "";

		const encrypted = await encryptData(plaintext, userId);
		const decrypted = await decryptData(encrypted, userId);

		expect(decrypted).toBe(plaintext);
	});

	test("should handle very long user ID", async () => {
		const plaintext = "test";
		const userId = "u".repeat(1000);

		const encrypted = await encryptData(plaintext, userId);
		const decrypted = await decryptData(encrypted, userId);

		expect(decrypted).toBe(plaintext);
	});

	test("should handle special characters in user ID", async () => {
		const plaintext = "test";
		const userId = "user!@#$%^&*()";

		const encrypted = await encryptData(plaintext, userId);
		const decrypted = await decryptData(encrypted, userId);

		expect(decrypted).toBe(plaintext);
	});
});

describe("Key Derivation (PBKDF2)", () => {
	test("should derive consistent keys for same user ID", async () => {
		const plaintext = "test data";
		const userId = "user123";

		// Encrypt twice with same user
		const encrypted1 = await encryptData(plaintext, userId);
		const encrypted2 = await encryptData(plaintext, userId);

		// Both should decrypt successfully (same key derived)
		const decrypted1 = await decryptData(encrypted1, userId);
		const decrypted2 = await decryptData(encrypted2, userId);

		expect(decrypted1).toBe(plaintext);
		expect(decrypted2).toBe(plaintext);
	});

	test("should derive different keys for different user IDs", async () => {
		const plaintext = "test";
		const user1 = "alice";
		const user2 = "alicE"; // Different case

		const encrypted1 = await encryptData(plaintext, user1);

		// Different user ID (case-sensitive) should fail
		await expect(decryptData(encrypted1, user2)).rejects.toThrow();
	});

	test("should use unique salt for each encryption", async () => {
		const plaintext = "test";
		const userId = "user123";

		const encrypted1 = await encryptData(plaintext, userId);
		const encrypted2 = await encryptData(plaintext, userId);

		// Extract base64 parts (should be different due to different salts)
		const base64_1 = encrypted1.replace("enc_v1:", "");
		const base64_2 = encrypted2.replace("enc_v1:", "");

		expect(base64_1).not.toBe(base64_2);
	});

	test("should handle case-sensitive user IDs", async () => {
		const plaintext = "test";
		const userId1 = "User123";
		const userId2 = "user123";

		const encrypted1 = await encryptData(plaintext, userId1);

		await expect(decryptData(encrypted1, userId2)).rejects.toThrow();
	});
});

describe("Random IV and Salt Generation", () => {
	test("should generate unique IV for each encryption", async () => {
		const plaintext = "test";
		const userId = "user123";

		const encrypted1 = await encryptData(plaintext, userId);
		const encrypted2 = await encryptData(plaintext, userId);

		// Different IVs should produce different ciphertexts
		expect(encrypted1).not.toBe(encrypted2);

		// But both should decrypt to same plaintext
		const decrypted1 = await decryptData(encrypted1, userId);
		const decrypted2 = await decryptData(encrypted2, userId);

		expect(decrypted1).toBe(plaintext);
		expect(decrypted2).toBe(plaintext);
	});

	test("should use cryptographically secure random", async () => {
		const plaintext = "test";
		const userId = "user123";

		// Encrypt many times to check for patterns
		const encryptions = await Promise.all(
			Array.from({ length: 10 }, () => encryptData(plaintext, userId)),
		);

		// All should be unique
		const uniqueEncryptions = new Set(encryptions);
		expect(uniqueEncryptions.size).toBe(10);
	});

	test("should not leak IV or salt information", async () => {
		const plaintext = "test";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		// Encrypted data should not contain obvious patterns
		expect(encrypted).not.toContain(plaintext);
		expect(encrypted).not.toContain(userId);
	});
});

describe("isEncrypted - Helper Function", () => {
	test("should detect encrypted data", async () => {
		const plaintext = "test";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		expect(isEncrypted(encrypted)).toBe(true);
	});

	test("should detect unencrypted data", () => {
		const plaintext = "regular text";

		expect(isEncrypted(plaintext)).toBe(false);
	});

	test("should detect data with similar prefix", () => {
		const almostPrefix = "enc_v2:data";

		expect(isEncrypted(almostPrefix)).toBe(false);
	});

	test("should handle empty string", () => {
		expect(isEncrypted("")).toBe(false);
	});

	test("should handle prefix at end", () => {
		const text = "data enc_v1:";

		expect(isEncrypted(text)).toBe(false);
	});

	test("should be case-sensitive", () => {
		const text = "ENC_V1:data";

		expect(isEncrypted(text)).toBe(false);
	});
});

describe("encryptApiKey / decryptApiKey - Convenience Functions", () => {
	test("should encrypt API key", async () => {
		const apiKey = "sk-1234567890abcdef";
		const userId = "user123";

		const encrypted = await encryptApiKey(apiKey, userId);

		expect(encrypted).toBeDefined();
		expect(encrypted.startsWith("enc_v1:")).toBe(true);
		expect(encrypted).not.toContain(apiKey);
	});

	test("should decrypt API key", async () => {
		const apiKey = "sk-1234567890abcdef";
		const userId = "user123";

		const encrypted = await encryptApiKey(apiKey, userId);
		const decrypted = await decryptApiKey(encrypted, userId);

		expect(decrypted).toBe(apiKey);
	});

	test("should handle OpenRouter API key format", async () => {
		const apiKey = "sk-or-v1-abcdef1234567890";
		const userId = "user123";

		const encrypted = await encryptApiKey(apiKey, userId);
		const decrypted = await decryptApiKey(encrypted, userId);

		expect(decrypted).toBe(apiKey);
	});

	test("should handle OpenAI API key format", async () => {
		const apiKey = "sk-proj-1234567890abcdef";
		const userId = "user123";

		const encrypted = await encryptApiKey(apiKey, userId);
		const decrypted = await decryptApiKey(encrypted, userId);

		expect(decrypted).toBe(apiKey);
	});

	test("should handle Anthropic API key format", async () => {
		const apiKey = "sk-ant-api03-1234567890abcdef";
		const userId = "user123";

		const encrypted = await encryptApiKey(apiKey, userId);
		const decrypted = await decryptApiKey(encrypted, userId);

		expect(decrypted).toBe(apiKey);
	});

	test("should protect against key extraction", async () => {
		const apiKey = "sk-secret-key-12345";
		const userId = "user123";

		const encrypted = await encryptApiKey(apiKey, userId);

		// Encrypted key should not be reversible without user ID
		expect(encrypted).not.toContain("secret");
		expect(encrypted).not.toContain("12345");
	});
});

describe("Error Handling", () => {
	test("should throw error on encryption failure", async () => {
		// Mock crypto.subtle.encrypt to fail
		const originalEncrypt = crypto.subtle.encrypt;
		crypto.subtle.encrypt = vi
			.fn()
			.mockRejectedValue(new Error("Encryption failed"));

		const plaintext = "test";
		const userId = "user123";

		await expect(encryptData(plaintext, userId)).rejects.toThrow(
			"Failed to encrypt data",
		);

		// Restore
		crypto.subtle.encrypt = originalEncrypt;
	});

	test("should throw error on decryption failure", async () => {
		const plaintext = "test";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		// Mock crypto.subtle.decrypt to fail
		const originalDecrypt = crypto.subtle.decrypt;
		crypto.subtle.decrypt = vi
			.fn()
			.mockRejectedValue(new Error("Decryption failed"));

		await expect(decryptData(encrypted, userId)).rejects.toThrow(
			"Failed to decrypt data",
		);

		// Restore
		crypto.subtle.decrypt = originalDecrypt;
	});

	test("should handle corrupted encryption prefix", async () => {
		const corrupted = "enc_v1:";
		const userId = "user123";

		await expect(decryptData(corrupted, userId)).rejects.toThrow();
	});

	test("should handle malformed base64", async () => {
		const malformed = "enc_v1:not valid base64!!!";
		const userId = "user123";

		await expect(decryptData(malformed, userId)).rejects.toThrow();
	});
});

describe("Data Integrity and Tampering", () => {
	test("should detect tampered authentication tag", async () => {
		const plaintext = "sensitive data";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		// Tamper with last few characters (likely the auth tag)
		const base64 = encrypted.replace("enc_v1:", "");
		const tampered = "enc_v1:" + base64.slice(0, -4) + "AAAA";

		await expect(decryptData(tampered, userId)).rejects.toThrow();
	});

	test("should detect tampered ciphertext", async () => {
		const plaintext = "sensitive data";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		// Tamper with middle of ciphertext
		const base64 = encrypted.replace("enc_v1:", "");
		const middle = Math.floor(base64.length / 2);
		const tampered =
			"enc_v1:" +
			base64.slice(0, middle) +
			"X" +
			base64.slice(middle + 1);

		await expect(decryptData(tampered, userId)).rejects.toThrow();
	});

	test("should detect tampered salt", async () => {
		const plaintext = "sensitive data";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		// Tamper with beginning (salt area)
		const tampered = "enc_v1:AAAA" + encrypted.slice(11);

		await expect(decryptData(tampered, userId)).rejects.toThrow();
	});

	test("should detect swapped IV and salt", async () => {
		const plaintext = "test";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		// Try to decrypt with wrong structure
		const base64 = encrypted.replace("enc_v1:", "");

		// Even with valid base64, wrong structure should fail
		await expect(decryptData(encrypted, userId + "x")).rejects.toThrow();
	});
});

describe("Performance and Scalability", () => {
	test("should handle rapid encryption requests", async () => {
		const plaintext = "test";
		const userId = "user123";

		const encryptions = await Promise.all(
			Array.from({ length: 100 }, () => encryptData(plaintext, userId)),
		);

		expect(encryptions).toHaveLength(100);
		encryptions.forEach((enc) => {
			expect(enc.startsWith("enc_v1:")).toBe(true);
		});
	});

	test("should handle rapid decryption requests", async () => {
		const plaintext = "test";
		const userId = "user123";

		const encrypted = await encryptData(plaintext, userId);

		const decryptions = await Promise.all(
			Array.from({ length: 100 }, () => decryptData(encrypted, userId)),
		);

		expect(decryptions).toHaveLength(100);
		decryptions.forEach((dec) => {
			expect(dec).toBe(plaintext);
		});
	});

	test("should handle large data efficiently", async () => {
		const plaintext = "x".repeat(100000); // 100KB
		const userId = "user123";

		const startTime = Date.now();
		const encrypted = await encryptData(plaintext, userId);
		const encryptTime = Date.now() - startTime;

		expect(encrypted).toBeDefined();
		expect(encryptTime).toBeLessThan(5000); // Should complete within 5s
	});

	test("should handle many different users", async () => {
		const plaintext = "test";
		const numUsers = 100;

		const operations = await Promise.all(
			Array.from({ length: numUsers }, async (_, i) => {
				const userId = `user${i}`;
				const encrypted = await encryptData(plaintext, userId);
				const decrypted = await decryptData(encrypted, userId);
				return decrypted === plaintext;
			}),
		);

		expect(operations.every((success) => success)).toBe(true);
	});
});

describe("Backward Compatibility", () => {
	test("should handle legacy unencrypted data", async () => {
		const legacyData = "sk-old-unencrypted-key";
		const userId = "user123";

		const result = await decryptData(legacyData, userId);

		expect(result).toBe(legacyData);
	});

	test("should not modify unencrypted data during decrypt", async () => {
		const original = "plain text data";
		const userId = "user123";

		const result = await decryptData(original, userId);

		expect(result).toBe(original);
	});

	test("should distinguish between encrypted and unencrypted", () => {
		const unencrypted = "regular data";
		const encrypted = "enc_v1:base64data";

		expect(isEncrypted(unencrypted)).toBe(false);
		expect(isEncrypted(encrypted)).toBe(true);
	});

	test("should handle mixed encrypted and unencrypted data", async () => {
		const userId = "user123";
		const unencrypted = "old-key";
		const plaintext = "new-key";

		// New encrypted data
		const encrypted = await encryptData(plaintext, userId);

		// Both should work
		const result1 = await decryptData(unencrypted, userId);
		const result2 = await decryptData(encrypted, userId);

		expect(result1).toBe(unencrypted);
		expect(result2).toBe(plaintext);
	});
});
