import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, createChatForUser, listChats } from "@/lib/convex-server";
import { serializeChat } from "@/lib/chat-serializers";

// Rate limiting for chat creation
const CHAT_CREATE_LIMIT = Number(process.env.CHAT_CREATE_RATE_LIMIT ?? 10);
const CHAT_CREATE_WINDOW_MS = Number(process.env.CHAT_CREATE_WINDOW_MS ?? 60_000); // 1 minute

type RateBucket = {
	count: number;
	resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

function isRateLimited(userId: string): { limited: boolean; retryAfter?: number } {
	if (CHAT_CREATE_LIMIT <= 0) return { limited: false };
	
	const now = Date.now();
	const bucket = rateBuckets.get(userId);
	
	if (!bucket || now > bucket.resetAt) {
		rateBuckets.set(userId, { count: 1, resetAt: now + CHAT_CREATE_WINDOW_MS });
		return { limited: false };
	}
	
	if (bucket.count >= CHAT_CREATE_LIMIT) {
		return { limited: true, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
	}
	
	bucket.count += 1;
	return { limited: false };
}

// Cleanup old buckets periodically
setInterval(() => {
	const now = Date.now();
	const keysToDelete: string[] = [];
	rateBuckets.forEach((bucket, key) => {
		if (now > bucket.resetAt) {
			keysToDelete.push(key);
		}
	});
	keysToDelete.forEach((key) => rateBuckets.delete(key));
}, CHAT_CREATE_WINDOW_MS);

export async function GET() {
	const session = await getUserContext();
	const userId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	const chats = await listChats(userId);
	return NextResponse.json({ chats: chats.map(serializeChat) });
}

export async function POST(request: Request) {
	const session = await getUserContext();
	const userId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	
	// Check rate limit
	const rateLimitResult = isRateLimited(session.userId);
	if (rateLimitResult.limited) {
		return NextResponse.json(
			{ error: "Too many chat creation requests. Please try again later." },
			{ 
				status: 429,
				headers: {
					"Retry-After": rateLimitResult.retryAfter?.toString() ?? "60",
					"X-RateLimit-Limit": CHAT_CREATE_LIMIT.toString(),
					"X-RateLimit-Window": CHAT_CREATE_WINDOW_MS.toString(),
				},
			}
		);
	}
	
	const body = await request.json().catch(() => ({}));
	const title = typeof body?.title === "string" && body.title.trim().length > 0 ? body.title.trim() : "New Chat";
	const chat = await createChatForUser(userId, title);
	return NextResponse.json({ chat: serializeChat(chat) });
}
