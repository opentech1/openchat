import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "./index";

export const { GET, POST } = toNextJsHandler(auth.handler);
