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

type UserContext = {
	userId: string;
	isGuest: boolean;
};

const resolveUserContext = cache(async (): Promise<UserContext> => {
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
			await ensureGuestIdServer(id);
			return { userId: id, isGuest: false };
		}
	} catch (error) {
		if (process.env.NODE_ENV !== "test") {
			console.error("auth-server.getUserId", error);
		}
	}

	const headerUser = headerList.get(GUEST_ID_HEADER);
	if (headerUser) {
		await ensureGuestIdServer(headerUser);
		return { userId: headerUser, isGuest: true };
	}

	if (DEV_BYPASS_ENABLED) {
		const override = process.env.NEXT_PUBLIC_DEV_USER_ID || process.env.DEV_DEFAULT_USER_ID;
		if (override) {
			await ensureGuestIdServer(override);
			return { userId: override, isGuest: true };
		}
	}

	const fallbackId = await ensureGuestIdServer();
	return { userId: fallbackId, isGuest: true };
});

export async function getUserContext(): Promise<UserContext> {
	return resolveUserContext();
}

export async function getUserId(): Promise<string> {
	const { userId } = await resolveUserContext();
	return userId;
}
