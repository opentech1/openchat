export const GUEST_ID_COOKIE = "oc_guest_id";
export const GUEST_ID_STORAGE_KEY = "oc_guest_id";
export const GUEST_ID_HEADER = "x-user-id";

export function createGuestId(): string {
	let entropy: string;
	// Use window.crypto.getRandomValues if available (browser), fallback to Node.js crypto.randomBytes
	if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
		const arr = new Uint8Array(16);
		window.crypto.getRandomValues(arr);
		entropy = Array.from(arr).map(b => b.toString(36).padStart(2, "0")).join('');
	} else {
		// Node.js or fallback
		let bytes: Uint8Array;
		try {
			// Try to use Node.js crypto module if available
			bytes = (require("crypto").randomBytes(16));
		} catch {
			// As a VERY last resort (should not happen), fallback to Date.now (at least unique)
			return `guest_${Date.now().toString(36)}`;
		}
		entropy = Array.from(bytes).map(b => b.toString(36).padStart(2, "0")).join('');
	}
	return `guest_${entropy}`;
}
