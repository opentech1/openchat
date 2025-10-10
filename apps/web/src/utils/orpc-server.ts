import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "@/types/server-router";
import { getUserId } from "@/lib/auth-server";

const DEV_BYPASS_ENABLED =
	process.env.NODE_ENV !== "production" &&
	process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";

const SERVER_BASE_URL = (process.env.SERVER_INTERNAL_URL || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");

// Server-only ORPC client that enriches headers with Better Auth context.
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
		const requestHeaders = await headers();
		const base = Object.fromEntries(requestHeaders);
		const nextHeaders: Record<string, string> = { ...base } as Record<string, string>;

		// strip hop-by-hop and body-specific headers before forwarding
		delete nextHeaders["content-length"];
		delete nextHeaders["transfer-encoding"];
		delete nextHeaders["connection"];
		delete nextHeaders["keep-alive"];
		delete nextHeaders["proxy-connection"];
		delete nextHeaders["upgrade"];

		let resolvedUserId: string | undefined =
			typeof nextHeaders["x-user-id"] === "string" ? nextHeaders["x-user-id"] : undefined;

		if (!resolvedUserId) {
			resolvedUserId = await getUserId().catch(() => null) || undefined;
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
