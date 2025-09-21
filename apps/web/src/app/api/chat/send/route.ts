import { NextResponse } from "next/server";
import { serverClient } from "@/utils/orpc-server";
import { z } from "zod";

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
