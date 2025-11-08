import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Id } from "@server/convex/_generated/dataModel";
import { getConvexUserFromSession, sendMessagePair } from "@/lib/convex-server";
import { resolveAllowedOrigins, validateRequestOrigin } from "@/lib/request-origin";
import { validateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";
import { z } from "zod";
import { logError, logWarn } from "@/lib/logger-server";

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

const allowedOrigins = resolveAllowedOrigins();

export async function POST(req: Request) {
	// PERFORMANCE FIX: Validate input FIRST before any expensive operations
	let validatedPayload: z.infer<typeof payloadSchema>;
	try {
		validatedPayload = payloadSchema.parse(await req.json());
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ ok: false, issues: error.issues }, { status: 422 });
		}
		return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
	}

	const originResult = validateRequestOrigin(req, allowedOrigins);
	if (!originResult.ok) {
		return NextResponse.json({ ok: false, error: "Invalid request origin" }, { status: 403 });
	}
	const allowOrigin = originResult.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.CORS_ORIGIN ?? null;
	const corsHeaders: HeadersInit | undefined = allowOrigin
		? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" }
		: undefined;

	// CSRF protection
	const cookieStore = await cookies();
	const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME);
	const csrfValidation = validateCsrfToken(req, csrfCookie?.value);

	if (!csrfValidation.valid) {
		logWarn(`CSRF validation failed: ${csrfValidation.error}`);
		return NextResponse.json(
			{ ok: false, error: "CSRF validation failed" },
			{ status: 403, headers: corsHeaders },
		);
	}

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
