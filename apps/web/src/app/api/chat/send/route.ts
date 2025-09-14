import { NextResponse } from "next/server";
import { serverClient } from "@/utils/orpc-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { chatId, content } = await req.json();
    if (!chatId || !content) return NextResponse.json({ ok: false }, { status: 400 });
    const result = await serverClient.messages.send({ chatId, content });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

