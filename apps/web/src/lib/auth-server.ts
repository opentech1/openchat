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
		const sanitized = uid.trim();
		if (sanitized && sanitized.length <= 128) {
			if (process.env.NODE_ENV === "test" || DEV_BYPASS_ENABLED) return sanitized;
		}
	}

	if (DEV_BYPASS_ENABLED) {
		const fallback = process.env.NEXT_PUBLIC_DEV_USER_ID || process.env.DEV_DEFAULT_USER_ID || "dev-user";
		return fallback.trim().slice(0, 128) || "dev-user";
	}

	return null;
}
