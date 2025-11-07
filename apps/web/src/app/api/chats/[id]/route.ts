import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Id } from "@server/convex/_generated/dataModel";
import { getUserContext } from "@/lib/auth-server";
import { deleteChatForUser, ensureConvexUser } from "@/lib/convex-server";
import { withCsrfProtection, CSRF_COOKIE_NAME } from "@/lib/csrf";
import { chatIdSchema, createValidationErrorResponse } from "@/lib/validation";
import { logError } from "@/lib/logger-server";

export async function DELETE(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	// Get CSRF token from cookies
	const cookieStore = await cookies();
	const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME);

	return withCsrfProtection(request, csrfCookie?.value, async () => {
		try {
			// Validate chat ID
			const { id } = await context.params;
			const validation = chatIdSchema.safeParse(id);

			if (!validation.success) {
				return createValidationErrorResponse(validation.error);
			}

			const validatedId = validation.data;

			// Authenticate user
			const session = await getUserContext();
			const convexUserId = await ensureConvexUser({
				id: session.userId,
				email: session.email,
				name: session.name,
				image: session.image,
			});

			// Delete chat
			const chatId = validatedId as Id<"chats">;
			await deleteChatForUser(convexUserId, chatId);

			return NextResponse.json({ ok: true });
		} catch (error) {
			logError("Error deleting chat", error);
			return NextResponse.json(
				{ error: "Failed to delete chat" },
				{ status: 500 },
			);
		}
	});
}
