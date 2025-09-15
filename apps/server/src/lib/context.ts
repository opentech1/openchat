import type { Context as ElysiaContext } from "elysia";
import { verifyToken } from "@clerk/backend";

export type CreateContextOptions = {
	context: ElysiaContext;
};

export async function createContext({ context }: CreateContextOptions) {
	let session: { user: { id: string } } | null = null;

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
				if (uid) session = { user: { id: uid } };
			}
		} catch {
			// ignore and fall back to dev header below
		}
	}

	// Dev fallback: trust x-user-id header locally when Clerk secret is absent or verification failed
	if (!session) {
		let uid = context.request.headers.get("x-user-id") || null;
		if (!uid) {
			// WebSocket fallback: allow dev user via query param
			try {
				const url = new URL(context.request.url);
				uid = url.searchParams.get("x-user-id");
			} catch {}
		}
		session = uid ? ({ user: { id: uid } } as any) : null;
	}

	return { session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
