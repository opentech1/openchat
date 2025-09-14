import type { Context as ElysiaContext } from "elysia";

export type CreateContextOptions = {
	context: ElysiaContext;
};

export async function createContext({ context }: CreateContextOptions) {
	// Minimal auth context: trust an x-user-id header for private RPCs in dev.
	const uid = context.request.headers.get("x-user-id") || null;
	const session = uid ? ({ user: { id: uid } } as any) : null;
	return {
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
