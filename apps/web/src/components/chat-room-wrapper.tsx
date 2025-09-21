"use client";

import { useEffect, useState, type ComponentProps } from "react";
import ChatRoom from "@/components/chat-room";

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

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return <ChatRoomSkeleton />;
	return <ChatRoom {...props} />;
}
