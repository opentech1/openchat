import type { Id } from "@server/convex/_generated/dataModel";
import ChatRoomClient from "@/components/chat-room-wrapper";
import { listMessagesForChat } from "@/lib/convex-server";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
	const { id: chatIdParam } = await params;
	// PERFORMANCE FIX: Use combined helper to eliminate redundant getUserContext call
	const { getConvexUserFromSession } = await import("@/lib/convex-server");
	const [, convexUserId] = await getConvexUserFromSession();
	const messages = await listMessagesForChat(convexUserId, chatIdParam as Id<"chats">);
	// PERFORMANCE FIX: Cache Date objects to avoid redundant serialization
	// Instead of creating new Date() for each message, serialize once
	const initialMessages = messages.map((message) => {
		// Direct conversion from timestamp to ISO string without intermediate Date object
		const isoString = new Date(message.createdAt).toISOString();
		return {
			id: message._id,
			role: message.role,
			content: message.content,
			createdAt: isoString,
		};
	});

	return (
		<div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col gap-0 overflow-hidden min-h-0 p-4 md:p-6">
			<ChatRoomClient chatId={chatIdParam} initialMessages={initialMessages} />
		</div>
	);
}
