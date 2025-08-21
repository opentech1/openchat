import type { Context as HonoContext } from "hono";
import { createAuth } from "./auth";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const auth = createAuth();
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    session,
  };
}


export type Context = Awaited<ReturnType<typeof createContext>>;
