"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Provider as ChatStoreProvider } from "@ai-sdk-tools/store";
import ChatRoom from "@/components/chat-room";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";

function ChatRoomSkeleton() {
	return (
		<div className="mx-auto max-w-3xl p-4 md:p-6">
			<div className="animate-pulse space-y-4">
				<div className="h-4 w-1/3 rounded bg-muted" />
				<div className="h-24 rounded-xl bg-muted" />
			</div>
		</div>
	);
}

export default function ChatRoomWrapper(props: ComponentProps<typeof ChatRoom>) {
	const [mounted, setMounted] = useState(false);
	const initialUiMessages = useMemo(
		() =>
			props.initialMessages.map((message) =>
				toUiMessage(
					normalizeMessage({
						id: message.id,
						role: message.role,
						content: message.content,
						created_at: message.createdAt,
					}),
				),
			),
		[props.initialMessages],
	);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return <ChatRoomSkeleton />;
	return (
		<ChatStoreProvider initialMessages={initialUiMessages}>
			<ChatRoom {...props} />
		</ChatStoreProvider>
	);
}
