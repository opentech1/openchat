export const GUEST_ID_COOKIE = "oc_guest_id";
export const GUEST_ID_STORAGE_KEY = "oc_guest_id";
export const GUEST_ID_HEADER = "x-user-id";


function randomString(bytes = 8): string {
	if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
		const arr = new Uint8Array(bytes);
		window.crypto.getRandomValues(arr);
		// Convert to base36 string for compactness
		return Array.from(arr).map(b => b.toString(36)).join('');
	} else {
		// fallback (not secure): Math.random
		return Math.random().toString(36).slice(2);
	}
}

export function createGuestId(): string {
	const entropy = `${randomString(8)}${Date.now().toString(36)}`;
	return `guest_${entropy}`;
}
