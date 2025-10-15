import { createGuestId, GUEST_ID_COOKIE, GUEST_ID_STORAGE_KEY } from "./guest-id";
export { GUEST_ID_HEADER, GUEST_ID_COOKIE, GUEST_ID_STORAGE_KEY } from "./guest-id";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
	if (typeof document === "undefined") return null;
	const pattern = new RegExp(`(?:^|; )${name}=([^;]*)`);
	const match = document.cookie.match(pattern);
	return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
	if (typeof document === "undefined") return;
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

function persistGuestId(value: string) {
	try {
		localStorage.setItem(GUEST_ID_STORAGE_KEY, value);
	} catch {
		// ignore storage errors (private mode, etc.)
	}
	writeCookie(GUEST_ID_COOKIE, value);
}

export function ensureGuestIdClient(): string {
	let id: string | null = null;
	try {
		id = localStorage.getItem(GUEST_ID_STORAGE_KEY);
	} catch {
		id = null;
	}

	if (!id) {
		id = readCookie(GUEST_ID_COOKIE);
	}

	if (!id) {
		id = createGuestId();
	}

	persistGuestId(id);
	(window as any).__OC_GUEST_ID__ = id;
	return id;
}

export function resolveClientUserId(): string {
	if (typeof window === "undefined") {
		return createGuestId();
	}
	const override = (window as any).__DEV_USER_ID__ as string | undefined;
	const guest = ensureGuestIdClient();
	if (override && override !== guest) {
		persistGuestId(override);
		return override;
	}
	return guest;
}
