import { getUserId } from "@/lib/auth-server";
import { serverClient } from "@/utils/orpc-server";
import type { MessageRow } from "@/types/server-router";
import ChatRoomClient from "@/components/chat-room-wrapper";
import DashboardAccessFallback from "@/components/dashboard-access-fallback";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
	const userId = await getUserId();
	if (!userId) {
		return (
			<DashboardAccessFallback
				title="Sign in to open this chat"
				description="We need to verify your account before showing conversation history."
				showHomeLink={false}
			/>
		);
	}
	const { id: chatId } = await params;
	// Preload initial messages on the server for faster first paint
	const fetchedMessages: MessageRow[] = await serverClient.messages
		.list({ chatId })
		.catch(() => [] as MessageRow[]);
	const initialMessages = fetchedMessages.map((message: MessageRow) => ({
		id: message.id,
		role: message.role,
		content: message.content,
		createdAt: message.createdAt ?? new Date().toISOString(),
	}));

	return (
		<div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col gap-0 overflow-hidden min-h-0 p-4 md:p-6">
			<ChatRoomClient chatId={chatId} initialMessages={initialMessages} />
		</div>
	);
}
