/**
 * Client-side encryption utilities for end-to-end encryption of user data.
 * Uses Web Crypto API with AES-GCM for authenticated encryption.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16;
const ITERATIONS = 100000; // PBKDF2 iterations

// Marker to identify encrypted data
const ENCRYPTION_PREFIX = "enc_v1:";

/**
 * Derives an encryption key from user ID using PBKDF2
 */
async function deriveKey(userId: string, salt: Uint8Array): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(userId),
		{ name: "PBKDF2" },
		false,
		["deriveBits", "deriveKey"]
	);

	return crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt as BufferSource,
			iterations: ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: ALGORITHM, length: KEY_LENGTH },
		false,
		["encrypt", "decrypt"]
	);
}

/**
 * Encrypts a string using user-specific encryption key
 */
export async function encryptData(plaintext: string, userId: string): Promise<string> {
	try {
		const encoder = new TextEncoder();
		const data = encoder.encode(plaintext);

		// Generate random salt and IV
		const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
		const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

		// Derive encryption key
		const key = await deriveKey(userId, salt);

		// Encrypt data
		const encrypted = await crypto.subtle.encrypt(
			{ name: ALGORITHM, iv },
			key,
			data
		);

		// Combine salt + iv + ciphertext
		const combined = new Uint8Array(
			SALT_LENGTH + IV_LENGTH + encrypted.byteLength
		);
		combined.set(salt, 0);
		combined.set(iv, SALT_LENGTH);
		combined.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);

		// Encode as base64 with prefix
		const base64 = btoa(String.fromCharCode(...combined));
		return `${ENCRYPTION_PREFIX}${base64}`;
	} catch (error: unknown) {
		console.error("Encryption failed:", error);
		throw new Error("Failed to encrypt data");
	}
}

/**
 * Decrypts a string using user-specific encryption key
 */
export async function decryptData(ciphertext: string, userId: string): Promise<string> {
	try {
		// Check if data is encrypted
		if (!ciphertext.startsWith(ENCRYPTION_PREFIX)) {
			// Not encrypted, return as-is (backward compatibility)
			return ciphertext;
		}

		// Remove prefix and decode base64
		const base64 = ciphertext.slice(ENCRYPTION_PREFIX.length);
		const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

		// Extract salt, iv, and encrypted data
		const salt = combined.slice(0, SALT_LENGTH);
		const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
		const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH);

		// Derive decryption key
		const key = await deriveKey(userId, salt);

		// Decrypt data
		const decrypted = await crypto.subtle.decrypt(
			{ name: ALGORITHM, iv },
			key,
			encrypted
		);

		const decoder = new TextDecoder();
		return decoder.decode(decrypted);
	} catch (error: unknown) {
		console.error("Decryption failed:", error);
		throw new Error("Failed to decrypt data");
	}
}

/**
 * Checks if data is encrypted
 */
export function isEncrypted(data: string): boolean {
	return data.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Encrypts OpenRouter API key for server storage
 */
export async function encryptApiKey(apiKey: string, userId: string): Promise<string> {
	return encryptData(apiKey, userId);
}

/**
 * Decrypts OpenRouter API key from server storage
 */
export async function decryptApiKey(encryptedKey: string, userId: string): Promise<string> {
	return decryptData(encryptedKey, userId);
}
