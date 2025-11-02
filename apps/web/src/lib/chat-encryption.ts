/**
 * End-to-End Encryption for Chat Messages and Titles
 *
 * This module provides client-side encryption for all chat content.
 * The server never has access to the decryption keys, ensuring true E2E encryption.
 *
 * Algorithm: AES-GCM (256-bit)
 * Key Storage: localStorage (never transmitted to server)
 * IV: Randomly generated per encryption (12 bytes)
 */

const MASTER_KEY_STORAGE_KEY = "openchat.e2ee.masterKey";
const ENCRYPTION_VERSION = "v1";

export interface EncryptedData {
	/** Base64-encoded initialization vector */
	iv: string;
	/** Base64-encoded ciphertext */
	data: string;
	/** Encryption algorithm version for future-proofing */
	version: string;
}

function getStorage() {
	if (typeof window === "undefined") return null;
	try {
		if (window.localStorage) return window.localStorage;
	} catch {
		// localStorage blocked or unavailable
	}
	try {
		if (window.sessionStorage) return window.sessionStorage;
	} catch {
		// sessionStorage blocked or unavailable
	}
	return null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i += 1) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

let masterKeyPromise: Promise<CryptoKey> | null = null;

/**
 * Gets or creates the master encryption key for this user.
 * The key is stored in localStorage and never sent to the server.
 */
async function getMasterKey(): Promise<CryptoKey> {
	if (typeof window === "undefined" || !window.crypto?.subtle) {
		throw new Error("Web Crypto API not available");
	}

	if (!masterKeyPromise) {
		masterKeyPromise = (async () => {
			const storage = getStorage();
			let storedKey: string | null = null;

			// Try to load existing key
			if (storage) {
				try {
					storedKey = storage.getItem(MASTER_KEY_STORAGE_KEY);
				} catch {
					storedKey = null;
				}
			}

			// Import existing key if found
			if (storedKey) {
				try {
					const rawKey = base64ToArrayBuffer(storedKey);
					return await crypto.subtle.importKey(
						"raw",
						rawKey,
						{ name: "AES-GCM" },
						false,
						["encrypt", "decrypt"]
					);
				} catch {
					// Key corrupted, will generate new one
					if (storage) {
						try {
							storage.removeItem(MASTER_KEY_STORAGE_KEY);
						} catch {
							// ignore
						}
					}
				}
			}

			// Generate new 256-bit key
			const random = new Uint8Array(32);
			crypto.getRandomValues(random);
			let key = await crypto.subtle.importKey(
				"raw",
				random.buffer,
				{ name: "AES-GCM" },
				true,
				["encrypt", "decrypt"]
			);

			// Try to persist key
			try {
				const exported = await crypto.subtle.exportKey("raw", key);
				if (storage) {
					storage.setItem(MASTER_KEY_STORAGE_KEY, arrayBufferToBase64(exported));
				}
				key = await crypto.subtle.importKey(
					"raw",
					exported,
					{ name: "AES-GCM" },
					false,
					["encrypt", "decrypt"]
				);
			} catch {
				// Key will be in-memory only
			}

			return key;
		})();
	}

	return masterKeyPromise;
}

/**
 * Encrypts text content using AES-GCM.
 * Returns encrypted data with IV and version info.
 */
export async function encryptContent(plaintext: string): Promise<EncryptedData> {
	if (typeof window === "undefined") {
		throw new Error("Encryption only available in browser context");
	}

	const masterKey = await getMasterKey();

	// Generate random IV (12 bytes for AES-GCM)
	const iv = new Uint8Array(12);
	crypto.getRandomValues(iv);

	// Encrypt
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		masterKey,
		encoded
	);

	return {
		iv: arrayBufferToBase64(iv.buffer),
		data: arrayBufferToBase64(ciphertext),
		version: ENCRYPTION_VERSION,
	};
}

/**
 * Decrypts encrypted content.
 * Returns null if decryption fails.
 */
export async function decryptContent(encrypted: EncryptedData): Promise<string | null> {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		// Check version compatibility
		if (encrypted.version !== ENCRYPTION_VERSION) {
			console.warn(`Unsupported encryption version: ${encrypted.version}`);
			return null;
		}

		const masterKey = await getMasterKey();
		const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
		const ciphertext = base64ToArrayBuffer(encrypted.data);

		const decrypted = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv },
			masterKey,
			ciphertext
		);

		return new TextDecoder().decode(decrypted);
	} catch (error) {
		console.error("Decryption failed:", error);
		return null;
	}
}

/**
 * Checks if the user has an encryption key initialized.
 */
export function hasEncryptionKey(): boolean {
	if (typeof window === "undefined") return false;
	const storage = getStorage();
	if (!storage) return false;
	return storage.getItem(MASTER_KEY_STORAGE_KEY) != null;
}

/**
 * Clears the encryption key. WARNING: This will make all encrypted data unrecoverable!
 */
export function clearEncryptionKey(): void {
	if (typeof window === "undefined") return;
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.removeItem(MASTER_KEY_STORAGE_KEY);
		masterKeyPromise = null;
	} catch {
		// ignore
	}
}

/**
 * Initializes encryption key if not already present.
 * Should be called on user login/registration.
 */
export async function initializeEncryption(): Promise<void> {
	if (typeof window === "undefined") return;
	await getMasterKey();
}

/**
 * Helper to serialize encrypted data to JSON string for storage.
 */
export function serializeEncryptedData(encrypted: EncryptedData): string {
	return JSON.stringify(encrypted);
}

/**
 * Helper to deserialize encrypted data from JSON string.
 */
export function deserializeEncryptedData(json: string): EncryptedData | null {
	try {
		const parsed = JSON.parse(json);
		if (
			typeof parsed === "object" &&
			typeof parsed.iv === "string" &&
			typeof parsed.data === "string" &&
			typeof parsed.version === "string"
		) {
			return parsed as EncryptedData;
		}
		return null;
	} catch {
		return null;
	}
}
