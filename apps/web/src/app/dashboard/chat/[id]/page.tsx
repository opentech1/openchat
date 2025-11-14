import type { Id } from "@server/convex/_generated/dataModel";
import ChatRoomClient from "@/components/chat-room-wrapper";
import { listMessagesForChat } from "@/lib/convex-server";
import { redirect } from "next/navigation";
import { logError } from "@/lib/logger-server";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: chatIdParam } = await params;

		// Validate chat ID format
		if (!chatIdParam || typeof chatIdParam !== "string") {
			logError("Invalid chat ID format", { chatIdParam });
			redirect("/dashboard");
		}

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
				reasoning: message.reasoning,
				createdAt: isoString,
				attachments: message.attachments,
			};
		});

		return (
			<div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col gap-0 overflow-hidden min-h-0">
				<ChatRoomClient chatId={chatIdParam} initialMessages={initialMessages} />
			</div>
		);
	} catch (error) {
		// Log the error with context for debugging
		logError("Error loading chat page", error);

		// Redirect to dashboard on any error (auth, database, network, etc.)
		redirect("/dashboard");
	}
}
