import { randomBytes } from "crypto";
export const GUEST_ID_COOKIE = "oc_guest_id";
export const GUEST_ID_STORAGE_KEY = "oc_guest_id";
export const GUEST_ID_HEADER = "x-user-id";

export function createGuestId(): string {
	const randomStr = randomBytes(12).toString("base64url"); // ~16 chars, URL-safe
	const entropy = `${randomStr}${Date.now().toString(36)}`;
	return `guest_${entropy}`;
}
