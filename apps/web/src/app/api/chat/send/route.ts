import { NextResponse } from "next/server";
import { serverClient } from "@/utils/orpc-server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const DEFAULT_MESSAGE_CONTENT_MAX = 8_000;
const MESSAGE_CONTENT_MAX_LENGTH = (() => {
	const raw = Number(process.env.MESSAGE_MAX_LENGTH ?? DEFAULT_MESSAGE_CONTENT_MAX);
	if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MESSAGE_CONTENT_MAX;
	return Math.min(raw, 32_000);
})();

const messageContentSchema = z
	.string()
	.min(1)
	.max(MESSAGE_CONTENT_MAX_LENGTH, `Message content exceeds ${MESSAGE_CONTENT_MAX_LENGTH} characters`)
	.refine((value) => Buffer.byteLength(value, "utf8") <= MESSAGE_CONTENT_MAX_LENGTH, {
		message: `Message content exceeds ${MESSAGE_CONTENT_MAX_LENGTH} bytes`,
	});

const messageSchema = z.object({
	id: z.string().min(1).optional(),
	content: messageContentSchema,
	createdAt: z.union([z.string(), z.date()]).optional(),
});

const payloadSchema = z.object({
	chatId: z.string().min(1),
	userMessage: messageSchema,
	assistantMessage: messageSchema.optional(),
});

export async function POST(req: Request) {
	try {
		const payload = payloadSchema.parse(await req.json());
		const result = await serverClient.messages.send(payload);
		return NextResponse.json(result);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ ok: false, issues: error.issues }, { status: 422 });
		}
		console.error("/api/chat/send", error);
		return NextResponse.json({ ok: false }, { status: 500 });
	}
}
