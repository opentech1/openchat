import { createChatHandler, createOptionsHandler } from "./chat-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createChatHandler();
export const OPTIONS = createOptionsHandler();
