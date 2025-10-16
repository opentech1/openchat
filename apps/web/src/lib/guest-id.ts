export const GUEST_ID_COOKIE = "oc_guest_id";
export const GUEST_ID_STORAGE_KEY = "oc_guest_id";
export const GUEST_ID_HEADER = "x-user-id";

function toHex(bytes: ArrayLike<number>): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getCrypto(): Crypto | null {
	if (typeof globalThis === "undefined") return null;
	const maybeCrypto = (globalThis as { crypto?: Crypto }).crypto;
	return maybeCrypto ?? null;
}

export function createGuestId(): string {
	const cryptoApi = getCrypto();

	if (cryptoApi && typeof (cryptoApi as { randomUUID?: () => string }).randomUUID === "function") {
		const uuid = (cryptoApi as { randomUUID: () => string }).randomUUID();
		return `guest_${uuid.replace(/-/g, "")}`;
	}

	if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
		const bytes = new Uint8Array(16);
		cryptoApi.getRandomValues(bytes);
		return `guest_${toHex(bytes)}`;
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
		const nodeCrypto = require("crypto") as { randomBytes: (size: number) => Uint8Array };
		const bytes = nodeCrypto.randomBytes(16);
		return `guest_${toHex(bytes)}`;
	} catch {
		return `guest_${Date.now().toString(36)}`;
	}
}
