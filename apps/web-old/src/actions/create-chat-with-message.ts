"use server";

import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, createChatForUser, sendMessagePair } from "@/lib/convex-server";

export async function createChatWithMessageAction(message: string) {
	if (!message.trim()) {
		throw new Error("Message cannot be empty");
	}

	const session = await getUserContext();
	const convexUserId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});

	// Create the chat with a title derived from the message
	const title = message.trim().slice(0, 50) + (message.length > 50 ? "..." : "");
	const chat = await createChatForUser(convexUserId, title);

	// Send the initial user message
	await sendMessagePair({
		userId: convexUserId,
		chatId: chat._id,
		user: {
			content: message.trim(),
			createdAt: Date.now(),
		},
	});

	// Redirect to the new chat
	redirect(`/chat/${chat._id}`);
}
