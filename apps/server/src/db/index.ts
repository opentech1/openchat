
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as authSchema from "./schema/auth";
import * as chatSchema from "./schema/chat";

export const db = drizzle(env.DB, { 
  schema: { ...authSchema, ...chatSchema } 
});

export * from "./schema/auth";
export * from "./schema/chat";
