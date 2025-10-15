import { cache } from "react";
import { headers } from "next/headers";
import { resolveServerBaseUrls } from "@/utils/server-url";
import { ensureGuestIdServer } from "@/lib/guest.server";
import { GUEST_ID_HEADER } from "@/lib/guest-id";

const DEV_BYPASS_ENABLED =
	process.env.NODE_ENV !== "production" &&
	process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";

const { primary: SERVER_ORIGIN } = resolveServerBaseUrls();

async function fetchServerSession(headerList: Headers) {
	const cookie = headerList.get("cookie");
	const forwardedFor = headerList.get("x-forwarded-for");
	const userAgent = headerList.get("user-agent");

	const response = await fetch(`${SERVER_ORIGIN}/api/auth/get-session`, {
		method: "GET",
		headers: {
			...(cookie ? { cookie } : {}),
			...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
			...(userAgent ? { "user-agent": userAgent } : {}),
		},
		credentials: "include",
		cache: "no-store",
	});

	if (!response.ok) return null;
	return response.json().catch(() => null);
}

export const getUserId = cache(async (): Promise<string | null> => {
	let headerList: Headers;
	try {
		headerList = await headers();
	} catch (error) {
		if (process.env.NODE_ENV !== "test") {
			console.error("auth-server.getUserId headers", error);
		}
		headerList = new Headers();
	}

	try {
		const session = await fetchServerSession(headerList);
		if (session?.user?.id) {
			const id = session.user.id as string;
			ensureGuestIdServer(id);
			return id;
		}
		const headerUser = headerList.get(GUEST_ID_HEADER);
		if (headerUser) {
			ensureGuestIdServer(headerUser);
			return headerUser;
		}
	} catch (error) {
		if (process.env.NODE_ENV !== "test") {
			console.error("auth-server.getUserId", error);
		}
	}

	if (DEV_BYPASS_ENABLED) {
		const override = process.env.NEXT_PUBLIC_DEV_USER_ID || process.env.DEV_DEFAULT_USER_ID;
		if (override) {
			ensureGuestIdServer(override);
			return override;
		}
	}

	return ensureGuestIdServer();
});
