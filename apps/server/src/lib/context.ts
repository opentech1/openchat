import type { Context as ElysiaContext } from "elysia";
import { getSessionFromRequest } from "@openchat/auth";
import { timingSafeEqual } from "node:crypto";

export type CreateContextOptions = {
	context: ElysiaContext;
};

type MinimalSession = {
	user: { id: string };
	session?: {
		userId: string;
		id: string;
		expiresAt: Date;
		createdAt: Date;
		updatedAt: Date;
	};
};

export async function createContext({ context }: CreateContextOptions) {
	let session: MinimalSession | null = null;
	const isProduction = process.env.NODE_ENV === "production";
	const devBypassEnabled =
		!isProduction &&
		(process.env.DEV_ALLOW_HEADER_BYPASS ?? process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH ?? "1") !== "0";
	const envForceBypass = process.env.SERVER_ALLOW_HEADER_BYPASS === "1";
	const headerBypassSecret = process.env.SERVER_HEADER_BYPASS_SECRET ?? "";
	const requestBypassSecret = context.request.headers.get("x-canary-secret") ?? "";
	const secretMatches =
		Boolean(headerBypassSecret) &&
		headerBypassSecret.length === requestBypassSecret.length &&
		headerBypassSecret.length > 0 &&
		timingSafeEqual(Buffer.from(headerBypassSecret), Buffer.from(requestBypassSecret));
	const headerBypassEnabled = devBypassEnabled || envForceBypass || secretMatches;

	try {
		const authSession = await getSessionFromRequest(context.request);
		if (authSession?.user?.id) {
			session = {
				...(authSession as unknown as MinimalSession),
				user: { id: authSession.user.id },
			};
		}
	} catch (error) {
		if (process.env.NODE_ENV !== "test") {
			console.error("better-auth.session", error);
		}
	}

	if (!session && headerBypassEnabled) {
		let uid = context.request.headers.get("x-user-id") || null;
		if (!uid) {
			try {
				const url = new URL(context.request.url);
				uid = url.searchParams.get("x-user-id");
			} catch {}
		}
		if (!uid && devBypassEnabled) {
			uid =
				process.env.NEXT_PUBLIC_DEV_USER_ID ||
				process.env.DEV_DEFAULT_USER_ID ||
				"dev-user";
		}
		if (uid) {
			const now = new Date();
			session = {
				user: { id: uid },
				session: {
					userId: uid,
					id: `header-${uid}`,
					expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
					createdAt: now,
					updatedAt: now,
				},
			};
		}
	}

	return { session, request: context.request };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
