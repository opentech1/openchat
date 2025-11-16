import { NextResponse } from "next/server";
import type { Id } from "@server/convex/_generated/dataModel";
import { getConvexUserFromSession, sendMessagePair } from "@/lib/convex-server";
import { z } from "zod";
import { logError } from "@/lib/logger-server";
import { createValidationErrorResponse } from "@/lib/validation";
import { validateRequestSecurity } from "@/lib/api/security-helpers";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
	id: z.string().min(1).optional(),
	content: z.string().min(1),
	// SECURITY: Don't accept client timestamps - server will generate them
	// Client timestamps can be manipulated to reorder messages or cause issues
});

const payloadSchema = z.object({
	chatId: z.string().min(1),
	userMessage: messageSchema,
	assistantMessage: messageSchema.optional(),
});

export async function POST(req: Request) {
	// PERFORMANCE FIX: Validate input FIRST before any expensive operations
	let validatedPayload: z.infer<typeof payloadSchema>;
	try {
		const body = await req.json().catch(() => ({}));
		const validation = payloadSchema.safeParse(body);

		if (!validation.success) {
			// Use standardized validation error response
			return createValidationErrorResponse(validation.error);
		}

		validatedPayload = validation.data;
	} catch (error) {
		return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
	}

	// Validate security (CSRF + Origin)
	const securityResult = await validateRequestSecurity(req);
	if (!securityResult.csrfValid || !securityResult.originValid) {
		return NextResponse.json(
			{ ok: false, error: securityResult.error },
			{ status: 403, headers: securityResult.corsHeaders },
		);
	}
	const corsHeaders = securityResult.corsHeaders;

	try {
		// PERFORMANCE FIX: Use combined helper to eliminate redundant getUserContext call
		const [, convexUserId] = await getConvexUserFromSession();
		// SECURITY: Use server-generated timestamps only, ignore client timestamps
		const result = await sendMessagePair({
			userId: convexUserId,
			chatId: validatedPayload.chatId as Id<"chats">,
			user: {
				content: validatedPayload.userMessage.content,
				// Don't pass createdAt - let server generate it
				clientMessageId: validatedPayload.userMessage.id,
			},
			assistant: validatedPayload.assistantMessage
				? {
					content: validatedPayload.assistantMessage.content,
					// Don't pass createdAt - let server generate it
					clientMessageId: validatedPayload.assistantMessage.id,
				}
				: undefined,
		});
		return NextResponse.json(result, { headers: corsHeaders });
	} catch (error) {
		logError("Failed to send chat message", error);
		return NextResponse.json({ ok: false }, { status: 500, headers: corsHeaders });
	}
}
