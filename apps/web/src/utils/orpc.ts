import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouterClient } from "../../../server/src/routers/index";

export const queryClient = new QueryClient();

export const link = new RPCLink({
    url: `${process.env.NEXT_PUBLIC_SERVER_URL}/rpc`,
    fetch(url, options) {
        return fetch(url, {
            ...options,
            credentials: "include",
        });
    },
    headers: async () => {
        if (typeof window !== "undefined") {
            return {};
        }

        const { headers } = await import("next/headers");
        const base = Object.fromEntries(await headers());
        // Enrich with Clerk auth on the server for protected RPCs
        try {
            const { auth } = await import("@clerk/nextjs/server");
            const { userId, getToken } = await auth();
            const token = await getToken().catch(() => null);
            const extra: Record<string, string> = {};
            if (token) extra["authorization"] = `Bearer ${token}`;
            if (userId) extra["x-user-id"] = userId; // dev fallback
            return { ...base, ...extra } as Record<string, string>;
        } catch {
            // ignore if Clerk is unavailable in this context
        }
        return base as Record<string, string>;
    },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
