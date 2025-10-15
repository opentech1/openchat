import { cookies } from "next/headers";
import { createGuestId, GUEST_ID_COOKIE } from "./guest-id";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function ensureGuestIdServer(preferredId?: string): Promise<string> {
	const store = await cookies();
	const existing = store.get(GUEST_ID_COOKIE)?.value;
	if (existing) {
		if (preferredId && existing !== preferredId) {
			store.set({
				name: GUEST_ID_COOKIE,
				value: preferredId,
				path: "/",
				maxAge: ONE_YEAR_SECONDS,
				httpOnly: false,
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production",
			});
			return preferredId;
		}
		return existing;
	}

	const guestId = preferredId ?? createGuestId();
	store.set({
		name: GUEST_ID_COOKIE,
		value: guestId,
		path: "/",
		maxAge: ONE_YEAR_SECONDS,
		httpOnly: false,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
	return guestId;
}
