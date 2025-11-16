"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { invalidateSessionCache } from "@/lib/auth-server";

export async function signOutAction() {
	const cookieStore = await cookies();

	// SECURITY: Invalidate session cache before clearing cookies
	// This prevents serving stale sessions from cache after logout
	const secureCookie = cookieStore.get("__Secure-openchat.session_token");
	const normalCookie = cookieStore.get("openchat.session_token");
	const sessionCookie = secureCookie || normalCookie;

	if (sessionCookie?.value) {
		invalidateSessionCache(sessionCookie.value);
	}

	// Clear auth cookies (legacy and current cookie names)
	const cookieNames = [
		"openchat-session-token",
		"openchat.session_token",
		"__Secure-openchat.session_token",
	];

	for (const name of cookieNames) {
		cookieStore.delete(name);
	}

	redirect("/");
}
