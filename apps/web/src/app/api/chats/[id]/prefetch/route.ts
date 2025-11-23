"use server";

import type { Id } from "@server/convex/_generated/dataModel";
import { NextResponse } from "next/server";

import { getUserContextFromRequest } from "@/lib/auth-server";
import { ensureConvexUser, listMessagesForChat } from "@/lib/convex-server";
import { logError } from "@/lib/logger-server";
import { chatIdSchema } from "@/lib/validation";
import { serializeMessage } from "@/lib/message-serializers";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await getUserContextFromRequest(request);
		if (!session) {
			return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
		}
		const convexUserId = await ensureConvexUser({
			id: session.userId,
			email: session.email,
			name: session.name,
			image: session.image,
		});

		const { id: chatIdParam } = await params;

		// Validate chat ID parameter
		if (!chatIdParam) {
			return NextResponse.json({ ok: false, error: "Missing chat id" }, { status: 400 });
		}

		// Validate chat ID format using Zod schema
		const validation = chatIdSchema.safeParse(chatIdParam);
		if (!validation.success) {
			return NextResponse.json(
				{
					ok: false,
					error: "Invalid chat id format",
					details: validation.error.issues.map((issue) => issue.message),
				},
				{ status: 400 }
			);
		}

		const messages = await listMessagesForChat(convexUserId, validation.data as Id<"chats">);
		// CRITICAL: Use serializeMessage to ensure consistent message format
		// This includes status and clientMessageId fields that were missing before
		const serialized = messages.map(serializeMessage);
		return NextResponse.json({ ok: true, chatId: validation.data, messages: serialized });
	} catch (error) {
		logError("Failed to prefetch chat messages", error);

		// Return generic error message in production
		const isProduction = process.env.NODE_ENV === "production";
		const errorMessage = isProduction ? "Failed to preload chat" : (error instanceof Error ? error.message : "Failed to preload chat");

		return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
	}
}
