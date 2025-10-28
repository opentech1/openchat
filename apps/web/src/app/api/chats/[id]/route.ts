import { NextResponse } from "next/server";
import type { Id } from "@server/convex/_generated/dataModel";
import { getUserContext } from "@/lib/auth-server";
import { deleteChatForUser, ensureConvexUser } from "@/lib/convex-server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
	const session = await getUserContext();
	const convexUserId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	const { id } = await context.params;
	const chatId = id as Id<"chats">;
	await deleteChatForUser(convexUserId, chatId);
	return NextResponse.json({ ok: true });
}
