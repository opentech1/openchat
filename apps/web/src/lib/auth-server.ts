import { headers } from "next/headers";

const DEV_BYPASS_ENABLED =
	process.env.NODE_ENV !== "production" &&
	process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";

export async function getUserId(): Promise<string | null> {
	// Try Clerk first if configured
	try {
		const { auth } = await import("@clerk/nextjs/server");
		const { userId } = await auth();
		if (userId) return userId;
	} catch {
		// ignore if Clerk not configured
	}

	const h = await headers();
	const uid = h.get("x-user-id");
	if (uid) {
		if (process.env.NODE_ENV === "test" || DEV_BYPASS_ENABLED) return uid;
	}

	if (DEV_BYPASS_ENABLED) {
		return process.env.NEXT_PUBLIC_DEV_USER_ID || process.env.DEV_DEFAULT_USER_ID || "dev-user";
	}

	return null;
}
