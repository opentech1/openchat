import type { Context as ElysiaContext } from "elysia";
import { getSessionFromRequest } from "@openchat/auth";

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
	const devBypassEnabled =
		process.env.NODE_ENV !== "production" &&
		(process.env.DEV_ALLOW_HEADER_BYPASS ?? process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH ?? "1") !== "0";

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

	// Dev fallback: trust x-user-id header locally when explicitly allowed
	if (!session && devBypassEnabled) {
		let uid = context.request.headers.get("x-user-id") || null;
		if (!uid) {
			// WebSocket fallback: allow dev user via query param
			try {
				const url = new URL(context.request.url);
				uid = url.searchParams.get("x-user-id");
			} catch {}
		}
		if (uid) {
			session = {
				user: { id: uid },
				session: {
					userId: uid,
					id: "dev-session",
					expiresAt: new Date(Date.now() + 60 * 60 * 1000),
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			};
		}
	}

	return { session, request: context.request };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
