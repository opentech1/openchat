import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// This endpoint provides a token for the Convex client to authenticate
// It reads the Better Auth session cookie and returns it as a token
export async function GET() {
	const cookieStore = await cookies();

	// Check for session token with openchat prefix
	const sessionToken = cookieStore.get("openchat.session_token")?.value;

	if (!sessionToken) {
		return NextResponse.json({ token: null }, { status: 200 });
	}

	return NextResponse.json({ token: sessionToken }, { status: 200 });
}
