import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, createChatForUser, listChats } from "@/lib/convex-server";
import { serializeChat } from "@/lib/chat-serializers";

export async function GET() {
	const session = await getUserContext();
	const userId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	const result = await listChats(userId);
	return NextResponse.json({ chats: result.chats.map(serializeChat), nextCursor: result.nextCursor });
}

export async function POST(request: Request) {
	const session = await getUserContext();
	const userId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	const body = await request.json().catch(() => ({}));
	const title = typeof body?.title === "string" && body.title.trim().length > 0 ? body.title.trim() : "New Chat";
	const chat = await createChatForUser(userId, title);
	return NextResponse.json({ chat: serializeChat(chat) });
}
