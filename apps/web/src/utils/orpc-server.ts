import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "@/types/server-router";
import { getUserId } from "@/lib/auth-server";
import { resolveServerBaseUrls } from "./server-url";

const DEV_BYPASS_ENABLED =
	process.env.NODE_ENV !== "production" &&
	process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";

const { primary: SERVER_BASE_URL, fallback: SERVER_FALLBACK_URL } = resolveServerBaseUrls();

// Server-only ORPC client that enriches headers with Better Auth context.
export const serverLink = new RPCLink({
	url: `${SERVER_BASE_URL}/rpc`,
	async fetch(url, options) {
		const requestUrl = typeof url === "string" ? url : (url as Request).url;

		const attempt = async (target: string) => {
			const baseInit: RequestInit = {
				...(options as RequestInit),
				method: (options as RequestInit)?.method ?? "POST",
				credentials: "include",
			};
			return fetch(target, baseInit);
		};

		try {
			const response = await attempt(requestUrl);
			if (
				SERVER_FALLBACK_URL &&
				response.status >= 500 &&
				response.status < 600 &&
				requestUrl.startsWith(SERVER_BASE_URL)
			) {
				const fallbackUrl = requestUrl.replace(SERVER_BASE_URL, SERVER_FALLBACK_URL);
				if (fallbackUrl !== requestUrl) {
					return attempt(fallbackUrl);
				}
			}
			return response;
		} catch (error) {
			if (!SERVER_FALLBACK_URL || !requestUrl.startsWith(SERVER_BASE_URL)) {
				throw error;
			}
			const fallbackUrl = requestUrl.replace(SERVER_BASE_URL, SERVER_FALLBACK_URL);
			if (fallbackUrl === requestUrl) throw error;
			return attempt(fallbackUrl);
		}
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
