import type { ReactNode } from "react";

import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, listChats } from "@/lib/convex-server";
import DashboardLayoutClient from "@/components/dashboard-layout-client";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const session = await getUserContext();
	const convexUserId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});

	// Fetch chats with error handling and graceful fallback
	let chats: Array<{
		id: string;
		title: string;
		updatedAt: string;
		lastMessageAt: string | null;
	}> = [];

	try {
		const { chats: rawChats } = await listChats(convexUserId);
		chats = rawChats.map((chat) => ({
			id: chat._id,
			title: chat.title,
			updatedAt: new Date(chat.updatedAt).toISOString(),
			lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt).toISOString() : null,
		}));
	} catch (error) {
		// Log the error for debugging but provide empty chat list as fallback
		console.error("[Dashboard Layout] Failed to fetch chats:", error);
		// User can still access dashboard, they just won't see their chat history
		// They can create new chats which should work fine
	}

	return <DashboardLayoutClient chats={chats}>{children}</DashboardLayoutClient>;
}
