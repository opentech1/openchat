import { logError } from "./logger";

const STORAGE_KEY = "openchat.openrouter.apiKey";
const MASTER_KEY_STORAGE_KEY = "openchat.openrouter.masterKey";

function getStorage() {
	if (typeof window === "undefined") return null;
	try {
		if (window.localStorage) return window.localStorage;
	} catch {
		// ignore
	}
	try {
		if (window.sessionStorage) return window.sessionStorage;
	} catch {
		// ignore
	}
	return null;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64: string) {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i += 1) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

let masterKeyPromise: Promise<CryptoKey> | null = null;

async function getCryptoKey() {
	if (typeof window === "undefined" || !window.crypto?.subtle) {
		throw new Error("Web Crypto not available");
	}
	if (!masterKeyPromise) {
		masterKeyPromise = (async () => {
			const storage = getStorage();
			let storedKey: string | null = null;
			if (storage) {
				try {
					storedKey = storage.getItem(MASTER_KEY_STORAGE_KEY);
				} catch {
					storedKey = null;
				}
			}

			if (storedKey) {
				try {
					const rawKey = base64ToArrayBuffer(storedKey);
					return await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
				} catch {
					if (storage) {
						try {
							storage.removeItem(MASTER_KEY_STORAGE_KEY);
						} catch {
							// ignore inability to clear corrupted key material
						}
					}
				}
			}

			const random = new Uint8Array(32);
			crypto.getRandomValues(random);
			let key = await crypto.subtle.importKey("raw", random.buffer, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
			try {
				const exported = await crypto.subtle.exportKey("raw", key);
				if (storage) {
					storage.setItem(MASTER_KEY_STORAGE_KEY, arrayBufferToBase64(exported));
				}
				key = await crypto.subtle.importKey("raw", exported, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
			} catch {
				// ignore storage/export failures; key will live only in-memory until tab reload
			}
			return key;
		})();
	}
	return masterKeyPromise;
}

export async function saveOpenRouterKey(apiKey: string) {
	if (typeof window === "undefined") return;
	const storage = getStorage();
	if (!storage) {
		throw new Error("Storage unavailable");
	}
	const cryptoKey = await getCryptoKey();
	const iv = new Uint8Array(12);
	crypto.getRandomValues(iv);
	const encoded = new TextEncoder().encode(apiKey);
	const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);
	const payload = {
		iv: arrayBufferToBase64(iv.buffer),
		data: arrayBufferToBase64(ciphertext),
	};
	storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function loadOpenRouterKey() {
	if (typeof window === "undefined") return null;
	const storage = getStorage();
	if (!storage) return null;
	const stored = storage.getItem(STORAGE_KEY);
	if (!stored) return null;
	try {
		const parsed = JSON.parse(stored) as { iv: string; data: string };
		const cryptoKey = await getCryptoKey();
		const iv = new Uint8Array(base64ToArrayBuffer(parsed.iv));
		const ciphertext = base64ToArrayBuffer(parsed.data);
		const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
		return new TextDecoder().decode(decrypted);
	} catch (error) {
		logError("Failed to decrypt stored OpenRouter API key", error);
		try {
			getStorage()?.removeItem(STORAGE_KEY);
			getStorage()?.removeItem(MASTER_KEY_STORAGE_KEY);
		} catch {
			// ignore storage errors
		}
		return null;
	}
}

export function removeOpenRouterKey() {
	if (typeof window === "undefined") return;
	const storage = getStorage();
	if (!storage) return;
	storage.removeItem(STORAGE_KEY);
}

export function hasStoredOpenRouterKey() {
	if (typeof window === "undefined") return false;
	const storage = getStorage();
	if (!storage) return false;
	return storage.getItem(STORAGE_KEY) != null;
}
