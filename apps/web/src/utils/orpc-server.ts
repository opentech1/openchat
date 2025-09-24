import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "@/types/server-router";

const DEV_BYPASS_ENABLED =
	process.env.NODE_ENV !== "production" &&
	process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";

const SERVER_BASE_URL = (process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_INTERNAL_URL || "http://localhost:3000").replace(/\/$/, "");

// Server-only ORPC client that enriches headers with Next/Clerk context.
export const serverLink = new RPCLink({
	url: `${SERVER_BASE_URL}/rpc`,
	fetch(url, options) {
		return fetch(url, {
			...options,
			credentials: "include",
		});
	},
	headers: async () => {
		const { headers } = await import("next/headers");
		const base = Object.fromEntries(await headers());
		const nextHeaders: Record<string, string> = { ...base } as Record<string, string>;

		// strip hop-by-hop and body-specific headers before forwarding
		delete nextHeaders["content-length"];
		delete nextHeaders["transfer-encoding"];
		delete nextHeaders["connection"];
		delete nextHeaders["keep-alive"];
		delete nextHeaders["proxy-connection"];
		delete nextHeaders["upgrade"];
		let resolvedUserId: string | undefined = typeof nextHeaders["x-user-id"] === "string" ? nextHeaders["x-user-id"] : undefined;

		try {
			const { auth } = await import("@clerk/nextjs/server");
			const { userId, getToken } = await auth();
			const token = await getToken().catch(() => null);
			if (token) nextHeaders["authorization"] = `Bearer ${token}`;
			if (userId) resolvedUserId = userId;
		} catch {
			// ignore missing Clerk setup
		}

		if (!resolvedUserId && DEV_BYPASS_ENABLED) {
			resolvedUserId =
				nextHeaders["x-user-id"] ||
				process.env.NEXT_PUBLIC_DEV_USER_ID ||
				process.env.DEV_DEFAULT_USER_ID ||
				"dev-user";
		}

		if (resolvedUserId) {
			nextHeaders["x-user-id"] = resolvedUserId;
		}

		return nextHeaders;
	},
});

export const serverClient: AppRouterClient = createORPCClient(serverLink);
