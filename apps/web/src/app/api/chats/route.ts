import { NextResponse } from "next/server";
import { getConvexUserFromRequest, createChatForUser, listChats } from "@/lib/convex-server";
import { serializeChat } from "@/lib/chat-serializers";
import { createChatSchema, createValidationErrorResponse } from "@/lib/validation";
import { logError } from "@/lib/logger-server";
import { createRateLimiter } from "@/lib/rate-limit";
import { getSessionTokenForRateLimit } from "@/lib/api/session-helpers";
import { validateCsrfForRequest } from "@/lib/api/security-helpers";

// Rate limiting configuration
const MIN_RATE_LIMIT = 1; // Minimum rate limit to prevent bypass via misconfiguration
const CHAT_CREATE_LIMIT = Math.max(MIN_RATE_LIMIT, parseInt(process.env.CHAT_CREATE_RATE_LIMIT ?? "10", 10) || 10);
const CHAT_CREATE_WINDOW_MS = Math.max(1000, parseInt(process.env.CHAT_CREATE_WINDOW_MS ?? "60000", 10) || 60_000); // 1 minute minimum

// Initialize rate limiter (automatically uses Redis if configured, otherwise in-memory)
// This will be created once per module load and reused across requests
let rateLimiterPromise: Promise<Awaited<ReturnType<typeof createRateLimiter>>> | null = null;

async function getRateLimiter() {
	if (!rateLimiterPromise) {
		rateLimiterPromise = createRateLimiter({
			limit: CHAT_CREATE_LIMIT,
			windowMs: CHAT_CREATE_WINDOW_MS,
			maxBuckets: 10000, // Only used for in-memory mode
		});
	}
	return rateLimiterPromise;
}

export async function GET(request: Request) {
	// Use request-based auth to read cookies directly from request headers
	const authResult = await getConvexUserFromRequest(request);
	if (!authResult) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const [, userId] = authResult;

	// Parse optional params
	const url = new URL(request.url);
	const cursor = url.searchParams.get("cursor") || undefined;
	const limitParam = url.searchParams.get("limit");
	const limit = limitParam ? parseInt(limitParam, 10) : undefined;

	const result = await listChats(userId, cursor, limit);
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
	const sessionToken = await getSessionTokenForRateLimit();

	// Check rate limit BEFORE user validation to prevent timing attacks
	// Using session token as identifier prevents user enumeration through timing analysis
	const rateLimiter = await getRateLimiter();
	const rateLimitResult = await rateLimiter.check(sessionToken);

	if (rateLimitResult.limited) {
		return NextResponse.json(
			{ error: "Too many chat creation requests. Please try again later." },
			{
				status: 429,
				headers: {
					"Retry-After": rateLimitResult.retryAfter?.toString() ?? "60",
					"X-RateLimit-Limit": CHAT_CREATE_LIMIT.toString(),
					"X-RateLimit-Window": CHAT_CREATE_WINDOW_MS.toString(),
					"X-RateLimit-Remaining": "0",
				},
			}
		);
	}

	// CSRF protection - validate after rate limiting but before user validation
	const csrfResult = await validateCsrfForRequest(request);
	if (!csrfResult.valid) {
		return NextResponse.json(
			{ error: "CSRF validation failed", message: csrfResult.error },
			{ status: 403 },
		);
	}

	// Use request-based auth to read cookies directly from request headers
	const authResult = await getConvexUserFromRequest(request);
	if (!authResult) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const [, userId] = authResult;
		const chat = await createChatForUser(userId, validatedTitle);
		return NextResponse.json({ chat: serializeChat(chat) });
	} catch (error) {
		logError("Error creating chat", error);
		// Pass through the actual error message from Convex (e.g., rate limit messages)
		const errorMessage = error instanceof Error ? error.message : "Failed to create chat";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
