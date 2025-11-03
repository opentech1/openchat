import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, createChatForUser, listChats } from "@/lib/convex-server";
import { serializeChat } from "@/lib/chat-serializers";

// Rate limiting for chat creation
// NOTE: This in-memory implementation is suitable for single-instance deployments.
// For production multi-instance/serverless deployments, use Redis or a distributed rate limiter.
const CHAT_CREATE_LIMIT = parseInt(process.env.CHAT_CREATE_RATE_LIMIT ?? "10", 10) || 10;
const CHAT_CREATE_WINDOW_MS = parseInt(process.env.CHAT_CREATE_WINDOW_MS ?? "60000", 10) || 60_000; // 1 minute
const MAX_BUCKETS = 10000; // Prevent memory leaks

type RateBucket = {
	count: number;
	resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

function cleanupExpiredBuckets(now: number) {
	// Lazy cleanup on each request to avoid setInterval issues in serverless
	const keysToDelete: string[] = [];
	rateBuckets.forEach((bucket, key) => {
		if (now > bucket.resetAt) {
			keysToDelete.push(key);
		}
	});
	keysToDelete.forEach((key) => rateBuckets.delete(key));
	
	// If still too many buckets, remove oldest entries
	if (rateBuckets.size > MAX_BUCKETS) {
		const excess = rateBuckets.size - MAX_BUCKETS;
		let removed = 0;
		for (const key of rateBuckets.keys()) {
			rateBuckets.delete(key);
			if (++removed >= excess) break;
		}
	}
}

function isRateLimited(identifier: string): { limited: boolean; retryAfter?: number } {
	if (CHAT_CREATE_LIMIT <= 0) return { limited: false };
	
	const now = Date.now();
	cleanupExpiredBuckets(now);
	
	const bucket = rateBuckets.get(identifier);
	
	if (!bucket || now > bucket.resetAt) {
		rateBuckets.set(identifier, { count: 1, resetAt: now + CHAT_CREATE_WINDOW_MS });
		return { limited: false };
	}
	
	if (bucket.count >= CHAT_CREATE_LIMIT) {
		return { limited: true, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
	}
	
	bucket.count += 1;
	return { limited: false };
}

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
	// Get session token BEFORE getUserContext to prevent timing attacks
	// This allows rate limiting based on session token, avoiding user enumeration
	const cookieStore = await cookies();
	const sessionToken = cookieStore.get("openchat.session-token")?.value ?? "anonymous";
	
	// Check rate limit BEFORE user validation to prevent timing attacks
	// Using session token as identifier prevents user enumeration through timing analysis
	const rateLimitResult = isRateLimited(sessionToken);
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
	
	const session = await getUserContext();
	const userId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	
	const body = await request.json().catch(() => ({}));
	const title = typeof body?.title === "string" ? body.title : "New Chat";
	const chat = await createChatForUser(userId, title);
	return NextResponse.json({ chat: serializeChat(chat) });
}
