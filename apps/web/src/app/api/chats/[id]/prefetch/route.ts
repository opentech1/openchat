"use server";

import type { Id } from "@server/convex/_generated/dataModel";
import { NextResponse } from "next/server";

import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, listMessagesForChat } from "@/lib/convex-server";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await getUserContext();
		const convexUserId = await ensureConvexUser({
			id: session.userId,
			email: session.email,
			name: session.name,
			image: session.image,
		});
		const { id: chatIdParam } = await params;
		if (!chatIdParam) {
			return NextResponse.json({ ok: false, error: "Missing chat id" }, { status: 400 });
		}
		const messages = await listMessagesForChat(convexUserId, chatIdParam as Id<"chats">);
		const serialized = messages.map((message) => ({
			id: message._id,
			role: message.role,
			content: message.content,
			createdAt: new Date(message.createdAt).toISOString(),
		}));
		return NextResponse.json({ ok: true, chatId: chatIdParam, messages: serialized });
	} catch (error) {
		console.error("/api/chats/[id]/prefetch", error);
		return NextResponse.json({ ok: false, error: "Failed to preload chat" }, { status: 500 });
	}
}
