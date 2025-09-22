import type { Context as ElysiaContext } from "elysia";
import { verifyToken } from "@clerk/backend";

export type CreateContextOptions = {
	context: ElysiaContext;
};

export async function createContext({ context }: CreateContextOptions) {
	let session: { user: { id: string } } | null = null;
	const devBypassEnabled =
		process.env.NODE_ENV !== "production" &&
		(process.env.DEV_ALLOW_HEADER_BYPASS ?? process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH ?? "1") !== "0";

	// Prefer real Clerk verification via Bearer token when secret is configured
	const secret = process.env.CLERK_SECRET_KEY;
	if (secret) {
		try {
			const authz = context.request.headers.get("authorization") || context.request.headers.get("Authorization");
			let token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
			// WebSocket fallback: allow token via query param when headers aren't available
			if (!token) {
				const url = new URL(context.request.url);
				const t = url.searchParams.get("token");
				if (t) token = t;
			}
			if (token) {
				const claims = await (verifyToken as any)(token, { secretKey: secret });
				const uid = (claims?.sub ?? claims?.payload?.sub) as string | undefined;
				if (uid) {
					const sanitized = uid.trim();
					if (sanitized.length > 0 && sanitized.length <= 128) {
						session = { user: { id: sanitized } };
					}
				}
			}
		} catch {
			// ignore and fall back to dev header below
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
			const sanitized = uid.trim();
			if (sanitized.length > 0 && sanitized.length <= 128) {
				session = { user: { id: sanitized } } as const;
			}
		}
	}

	return { session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
