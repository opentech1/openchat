import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-server";
import { serverClient } from "@/utils/orpc-server";
import DashboardAccessFallback from "@/components/dashboard-access-fallback";

export const dynamic = "force-dynamic";

export default async function NewChatPage() {
	const userId = await getUserId();
	if (!userId) {
		return (
			<DashboardAccessFallback
				title="Sign in to start a chat"
				description="Creating a new conversation requires an authenticated session. Please sign in and try again."
				showHomeLink={false}
			/>
		);
	}

	// Prefer server-created UUID; fallback to client-generated on failure
	try {
		const { id } = await serverClient.chats.create({ title: "New Chat" });
		redirect(`/dashboard/chat/${id}`);
	} catch {
		const id = (() => {
			try {
				return crypto.randomUUID();
			} catch {
				return Math.random().toString(36).slice(2) + Date.now().toString(36);
			}
		})();
		redirect(`/dashboard/chat/${id}`);
	}
}
