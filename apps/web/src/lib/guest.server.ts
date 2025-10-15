import { cookies } from "next/headers";
import { createGuestId, GUEST_ID_COOKIE } from "./guest-id";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type MutableCookies = {
	set?: (
		name: string,
		value: string,
		options?: {
			path?: string;
			maxAge?: number;
			httpOnly?: boolean;
			sameSite?: "strict" | "lax" | "none";
			secure?: boolean;
		}
	) => void;
};

export async function ensureGuestIdServer(preferredId?: string): Promise<string> {
	const store = await cookies();
	const existing = store.get(GUEST_ID_COOKIE)?.value;
	const mutable = store as unknown as MutableCookies;
	const canSet = typeof mutable.set === "function";
	if (existing) {
		if (preferredId && existing !== preferredId) {
			if (canSet) {
				try {
					mutable.set!(GUEST_ID_COOKIE, preferredId, {
						path: "/",
						maxAge: ONE_YEAR_SECONDS,
						httpOnly: false,
						sameSite: "lax",
						secure: process.env.NODE_ENV === "production",
					});
				} catch (error) {
					if (process.env.NODE_ENV !== "production") {
						console.warn("guest-id:set", "failed to persist preferred guest id", error);
					}
				}
			}
			return preferredId;
		}
		return existing;
	}

	const guestId = preferredId ?? createGuestId();
	if (canSet) {
		try {
			mutable.set!(GUEST_ID_COOKIE, guestId, {
				path: "/",
				maxAge: ONE_YEAR_SECONDS,
				httpOnly: false,
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production",
			});
		} catch (error) {
			if (process.env.NODE_ENV !== "production") {
				console.warn("guest-id:set", "failed to persist guest id", error);
			}
		}
	}
	return guestId;
}
