import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, createChatForUser } from "@/lib/convex-server";

export default async function NewChatPage() {
	const session = await getUserContext();
	const convexUserId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	// Note: Default chat title is not encrypted since this runs server-side
	// Future enhancement: Move chat creation to client-side for E2E encrypted titles
	const chat = await createChatForUser(convexUserId, { title: "New Chat" });
	redirect(`/dashboard/chat/${chat._id}`);
}
