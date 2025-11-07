import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Id } from "@server/convex/_generated/dataModel";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, sendMessagePair } from "@/lib/convex-server";
import { resolveAllowedOrigins, validateRequestOrigin } from "@/lib/request-origin";
import { validateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";
import { z } from "zod";
import { logError, logWarn } from "@/lib/logger-server";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
	id: z.string().min(1).optional(),
	content: z.string().min(1),
	createdAt: z.union([z.string(), z.date()]).optional(),
});

const payloadSchema = z.object({
	chatId: z.string().min(1),
	userMessage: messageSchema,
	assistantMessage: messageSchema.optional(),
});

const allowedOrigins = resolveAllowedOrigins();

export async function POST(req: Request) {
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
		const payload = payloadSchema.parse(await req.json());
		const session = await getUserContext();
		const convexUserId = await ensureConvexUser({
			id: session.userId,
			email: session.email,
			name: session.name,
			image: session.image,
		});
		const result = await sendMessagePair({
			userId: convexUserId,
			chatId: payload.chatId as Id<"chats">,
			user: {
				content: payload.userMessage.content,
				createdAt: payload.userMessage.createdAt ? new Date(payload.userMessage.createdAt).getTime() : undefined,
				clientMessageId: payload.userMessage.id,
			},
			assistant: payload.assistantMessage
				? {
					content: payload.assistantMessage.content,
					createdAt: payload.assistantMessage.createdAt
						? new Date(payload.assistantMessage.createdAt).getTime()
						: undefined,
					clientMessageId: payload.assistantMessage.id,
				}
				: undefined,
		});
		return NextResponse.json(result, { headers: corsHeaders });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ ok: false, issues: error.issues }, { status: 422, headers: corsHeaders });
		}
		logError("Failed to send chat message", error);
		return NextResponse.json({ ok: false }, { status: 500, headers: corsHeaders });
	}
}
