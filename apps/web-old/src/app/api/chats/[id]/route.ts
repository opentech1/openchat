import { NextResponse } from "next/server";
import type { Id } from "@server/convex/_generated/dataModel";
import { deleteChatForUser, getConvexUserFromRequest } from "@/lib/convex-server";
import { withCsrfProtection, CSRF_COOKIE_NAME } from "@/lib/csrf";
import { chatIdSchema, createValidationErrorResponse } from "@/lib/validation";
import { logError } from "@/lib/logger-server";
import { auditChatDelete, getRequestMetadata } from "@/lib/audit-logger";
import { chatsCache, isRedisCacheAvailable } from "@/lib/cache";

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

	// Get CSRF token from request cookies
	const cookieHeader = request.headers.get("cookie") || "";
	const csrfMatch = cookieHeader.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
	const csrfCookieValue = csrfMatch?.[1];

	return withCsrfProtection(request, csrfCookieValue, async () => {
		// Use request-based auth to read cookies directly from request headers
		const authResult = await getConvexUserFromRequest(request);
		if (!authResult) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		try {
			const [session, convexUserId] = authResult;

			// Delete chat
			const chatId = validatedId as Id<"chats">;
			await deleteChatForUser(convexUserId, chatId);

			// Invalidate user's chat list cache after deleting a chat
			if (isRedisCacheAvailable()) {
				// Don't await - fire and forget for better latency
				chatsCache.invalidateForUser(convexUserId).catch((err) => {
					logError("[chats] Failed to invalidate cache", err);
				});
			}

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
