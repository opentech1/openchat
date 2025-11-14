"use client";

import dynamicImport from "next/dynamic";

// Dynamically import ChatPreview with ssr: false to prevent server-side rendering
// This is necessary because ChatPreview uses Convex hooks which require ConvexProvider,
// which is only available on the client side
const ChatPreview = dynamicImport(() => import("@/components/chat-preview"), {
	ssr: false,
	loading: () => (
		<div className="w-full h-[200px] flex items-center justify-center text-muted-foreground">
			Loading...
		</div>
	),
});

export default function DashboardPage() {
	return (
		<div className="h-[100svh] grid place-items-center p-4">
			<div className="w-full max-w-2xl space-y-2">
				<ChatPreview className="w-full" />
			</div>
		</div>
	);
}
