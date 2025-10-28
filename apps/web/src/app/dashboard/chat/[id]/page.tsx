import type { Id } from "@server/convex/_generated/dataModel";
import ChatRoomClient from "@/components/chat-room-wrapper";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, listMessagesForChat } from "@/lib/convex-server";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
	const [{ id: chatIdParam }, session] = await Promise.all([params, getUserContext()]);
	const convexUserId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	const messages = await listMessagesForChat(convexUserId, chatIdParam as Id<"chats">);
	const initialMessages = messages.map((message) => ({
		id: message._id,
		role: message.role,
		content: message.content,
		createdAt: new Date(message.createdAt).toISOString(),
	}));

	return (
		<div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col gap-0 overflow-hidden min-h-0 p-4 md:p-6">
			<ChatRoomClient chatId={chatIdParam} initialMessages={initialMessages} />
		</div>
	);
}
