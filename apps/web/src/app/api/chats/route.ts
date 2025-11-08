import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConvexUserFromSession, createChatForUser, listChats } from "@/lib/convex-server";
import { serializeChat } from "@/lib/chat-serializers";
import { validateCsrfToken, requiresCsrfProtection, CSRF_COOKIE_NAME } from "@/lib/csrf";
import { createChatSchema, createValidationErrorResponse } from "@/lib/validation";
import { logError } from "@/lib/logger-server";

// Rate limiting for chat creation
// NOTE: This in-memory implementation is suitable for single-instance deployments.
// For production multi-instance/serverless deployments, use Redis or a distributed rate limiter.
const MIN_RATE_LIMIT = 1; // Minimum rate limit to prevent bypass via misconfiguration
const CHAT_CREATE_LIMIT = Math.max(MIN_RATE_LIMIT, parseInt(process.env.CHAT_CREATE_RATE_LIMIT ?? "10", 10) || 10);
const CHAT_CREATE_WINDOW_MS = Math.max(1000, parseInt(process.env.CHAT_CREATE_WINDOW_MS ?? "60000", 10) || 60_000); // 1 minute minimum
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
	// PERFORMANCE FIX: Use combined helper to eliminate redundant getUserContext call
	const [, userId] = await getConvexUserFromSession();
	const result = await listChats(userId);
	return NextResponse.json({ chats: result.chats.map(serializeChat), nextCursor: result.nextCursor });
}

export async function POST(request: Request) {
	// PERFORMANCE FIX: Validate request body FIRST before any expensive operations
	// This fails fast on invalid input without hitting auth/DB
	let validatedTitle: string;
	try {
		const body = await request.json().catch(() => ({}));
		const validation = createChatSchema.safeParse(body);

		if (!validation.success) {
			return createValidationErrorResponse(validation.error);
		}

		validatedTitle = validation.data.title;
	} catch (error) {
		logError("Error parsing request body", error);
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 },
		);
	}

	// Get session token BEFORE getUserContext to prevent timing attacks
	// This allows rate limiting based on session token, avoiding user enumeration
	const cookieStore = await cookies();
	// Check for secure cookie (production HTTPS) first, then fall back to normal cookie (development)
	const secureCookie = cookieStore.get("__Secure-openchat.session_token");
	const normalCookie = cookieStore.get("openchat.session_token");
	const sessionToken = secureCookie?.value ?? normalCookie?.value ?? "anonymous";

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

	// CSRF protection is handled by the client (see withCsrfProtection below)
	// We don't wrap the entire handler because we need to rate limit first
	const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME);
	const csrfValidation = requiresCsrfProtection(request.method)
		? validateCsrfToken(request, csrfCookie?.value)
		: { valid: true };

	if (!csrfValidation.valid) {
		return NextResponse.json(
			{ error: "CSRF validation failed", message: csrfValidation.error },
			{ status: 403 },
		);
	}

	// PERFORMANCE FIX: Use combined helper to eliminate redundant getUserContext call
	try {
		const [, userId] = await getConvexUserFromSession();
		const chat = await createChatForUser(userId, validatedTitle);
		return NextResponse.json({ chat: serializeChat(chat) });
	} catch (error) {
		logError("Error creating chat", error);
		return NextResponse.json(
			{ error: "Failed to create chat" },
			{ status: 500 },
		);
	}
}
