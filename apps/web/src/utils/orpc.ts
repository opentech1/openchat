import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouterClient } from "../../../server/src/routers/index";

// Client-safe ORPC utilities. Do not import any server-only modules here.
export const queryClient = new QueryClient();

const PUBLIC_SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");

export const link = new RPCLink({
	url: `${PUBLIC_SERVER_URL}/rpc`,
	fetch(url, options) {
		return fetch(url, {
			...options,
			credentials: "include",
		});
	},
	headers: async () => {
		const headers: Record<string, string> = {};
		if (typeof window !== "undefined") {
			const devUserId = (window as any).__DEV_USER_ID__ as string | undefined;
			if (devUserId) headers["x-user-id"] = devUserId;
		}
		return headers;
	},
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
