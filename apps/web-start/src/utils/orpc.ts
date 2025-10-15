import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouterClient } from "@web/types/server-router";
import { ensureGuestIdClient, resolveClientUserId, GUEST_ID_HEADER } from "@web/lib/guest.client";

export const queryClient = new QueryClient();

const PUBLIC_SERVER_URL = (import.meta.env.VITE_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");

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
      const userId = resolveClientUserId();
      headers[GUEST_ID_HEADER] = userId;
      ensureGuestIdClient();
    }
    return headers;
  },
});

export const client: AppRouterClient = createORPCClient(link);
export const orpc = createTanstackQueryUtils(client);

