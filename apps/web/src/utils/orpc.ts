import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouterClient } from "../../../server/src/routers/index";

// Client-safe ORPC utilities. Do not import any server-only modules here.
export const queryClient = new QueryClient();

export const link = new RPCLink({
    url: `${process.env.NEXT_PUBLIC_SERVER_URL}/rpc`,
    fetch(url, options) {
        return fetch(url, {
            ...options,
            credentials: "include",
        });
    },
    // On the client, browser fetch with credentials forwards cookies automatically.
    // Avoid server-only imports in this client-shared module.
    headers: async () => ({}),
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
