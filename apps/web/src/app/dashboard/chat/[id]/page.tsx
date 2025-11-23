import ChatRoomClient from "@/components/chat-room-wrapper";

export const dynamic = "force-dynamic";

/**
 * Chat Page - Now uses client-side data loading
 *
 * Previously, this page used server-side auth and data fetching which failed
 * in Edge environments (Vercel, Cloudflare) because cookies() from next/headers
 * doesn't work reliably.
 *
 * Now, the page just renders the ChatRoomClient which:
 * - Handles authentication client-side via AuthGuard in the layout
 * - Fetches messages via the client-side API
 */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
	const { id: chatIdParam } = await params;

	return (
		<div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col gap-0 min-h-0">
			<ChatRoomClient chatId={chatIdParam} initialMessages={[]} />
		</div>
	);
}
