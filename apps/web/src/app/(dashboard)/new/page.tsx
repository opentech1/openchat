import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, createChatForUser } from "@/lib/convex-server";

// Force dynamic rendering to avoid prerendering auth errors
export const dynamic = "force-dynamic";

export default async function NewChatPage() {
	const session = await getUserContext().catch(() => null);
	if (!session) {
		redirect("/auth/sign-in");
	}
	const convexUserId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	const chat = await createChatForUser(convexUserId, "New Chat");
	redirect(`/chat/${chat._id}`);
}
