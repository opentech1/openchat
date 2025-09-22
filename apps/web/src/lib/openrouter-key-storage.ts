const STORAGE_KEY = "openchat.openrouter.apiKey";
const MASTER_KEY_STORAGE_KEY = "openchat.openrouter.masterKey";

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

async function getCryptoKey() {
	if (typeof window === "undefined" || !window.crypto?.subtle) {
		throw new Error("Web Crypto not available");
	}
	let master = localStorage.getItem(MASTER_KEY_STORAGE_KEY);
	if (!master) {
		const random = new Uint8Array(32);
		crypto.getRandomValues(random);
		master = arrayBufferToBase64(random.buffer);
		localStorage.setItem(MASTER_KEY_STORAGE_KEY, master);
	}
	const keyData = base64ToArrayBuffer(master);
	return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function saveOpenRouterKey(apiKey: string) {
	if (typeof window === "undefined") return;
	const cryptoKey = await getCryptoKey();
	const iv = new Uint8Array(12);
	crypto.getRandomValues(iv);
	const encoded = new TextEncoder().encode(apiKey);
	const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);
	const payload = {
		iv: arrayBufferToBase64(iv.buffer),
		data: arrayBufferToBase64(ciphertext),
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function loadOpenRouterKey() {
	if (typeof window === "undefined") return null;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (!stored) return null;
	try {
		const parsed = JSON.parse(stored) as { iv: string; data: string };
		const cryptoKey = await getCryptoKey();
		const iv = new Uint8Array(base64ToArrayBuffer(parsed.iv));
		const ciphertext = base64ToArrayBuffer(parsed.data);
		const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
		return new TextDecoder().decode(decrypted);
	} catch (error) {
		console.error("Failed to decrypt stored OpenRouter API key", error);
		return null;
	}
}

export function removeOpenRouterKey() {
	if (typeof window === "undefined") return;
	localStorage.removeItem(STORAGE_KEY);
}

export function hasStoredOpenRouterKey() {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(STORAGE_KEY) != null;
}
