import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "./index.js";

export const { GET, POST } = toNextJsHandler(auth.handler);
