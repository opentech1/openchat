export const GUEST_ID_COOKIE = "oc_guest_id";
export const GUEST_ID_STORAGE_KEY = "oc_guest_id";
export const GUEST_ID_HEADER = "x-user-id";

export function createGuestId(): string {
	const entropy = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
	return `guest_${entropy}`;
}
