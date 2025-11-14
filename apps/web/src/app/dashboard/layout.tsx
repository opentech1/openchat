import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, listChats, getUserById } from "@/lib/convex-server";
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

	// Check if user has completed onboarding with error handling
	let user;
	try {
		user = await getUserById(convexUserId);
		if (!user?.onboardingCompletedAt) {
			redirect("/onboarding");
		}
	} catch (error) {
		// Log the error for debugging but don't crash the page
		console.error("[Dashboard Layout] Failed to fetch user:", error);
		// If we can't verify onboarding status, allow access but log it
		// This prevents the entire dashboard from crashing
		console.warn("[Dashboard Layout] Unable to verify onboarding status, allowing access");
	}

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
