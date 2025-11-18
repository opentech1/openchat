import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Id } from "@server/convex/_generated/dataModel";
import { deleteChatForUser, getConvexUserFromSession } from "@/lib/convex-server";
import { withCsrfProtection, CSRF_COOKIE_NAME } from "@/lib/csrf";
import { chatIdSchema, createValidationErrorResponse } from "@/lib/validation";
import { logError } from "@/lib/logger-server";
import { auditChatDelete, getRequestMetadata } from "@/lib/audit-logger";

export async function DELETE(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	// PERFORMANCE FIX: Validate chat ID FIRST before expensive operations
	const { id } = await context.params;
	const validation = chatIdSchema.safeParse(id);

	if (!validation.success) {
		return createValidationErrorResponse(validation.error);
	}

	const validatedId = validation.data;

	// Get CSRF token from cookies
	const cookieStore = await cookies();
	const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME);

	return withCsrfProtection(request, csrfCookie?.value, async () => {
		try {
			// PERFORMANCE FIX: Use combined helper to eliminate redundant getUserContext call
			const [session, convexUserId] = await getConvexUserFromSession();

			// Delete chat
			const chatId = validatedId as Id<"chats">;
			await deleteChatForUser(convexUserId, chatId);

			// SECURITY: Audit log chat deletion
			const { ipAddress, userAgent } = getRequestMetadata(request);
			await auditChatDelete({
				userId: session.id,
				chatId: validatedId,
				ipAddress,
				userAgent,
			});

			return NextResponse.json({ ok: true });
		} catch (error) {
			logError("Error deleting chat", error);
			// Pass through the actual error message from Convex (e.g., rate limit messages)
			const errorMessage = error instanceof Error ? error.message : "Failed to delete chat";
			return NextResponse.json(
				{ error: errorMessage },
				{ status: 500 },
			);
		}
	});
}
