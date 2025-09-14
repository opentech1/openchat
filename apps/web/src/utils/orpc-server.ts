import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "../../../server/src/routers/index";

// Server-only ORPC client that enriches headers with Next/Clerk context.
export const serverLink = new RPCLink({
    url: `${process.env.NEXT_PUBLIC_SERVER_URL}/rpc`,
    fetch(url, options) {
        return fetch(url, {
            ...options,
            credentials: "include",
        });
    },
    headers: async () => {
        const { headers } = await import("next/headers");
        const base = Object.fromEntries(await headers());
        try {
            const { auth } = await import("@clerk/nextjs/server");
            const { userId, getToken } = await auth();
            const token = await getToken().catch(() => null);
            const extra: Record<string, string> = {};
            if (token) extra["authorization"] = `Bearer ${token}`;
            if (userId) extra["x-user-id"] = userId;
            return { ...base, ...extra } as Record<string, string>;
        } catch {
            // If Clerk is not configured, just forward base headers
        }
        return base as Record<string, string>;
    },
});

export const serverClient: AppRouterClient = createORPCClient(serverLink);

