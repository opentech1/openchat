import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// This endpoint provides a token for the Convex client to authenticate
// It reads the Better Auth session cookie and returns it as a token
export async function GET() {
	const cookieStore = await cookies();

	// Check for session token with openchat prefix
	// In production (HTTPS), cookies get __Secure- prefix: "__Secure-openchat.session_token"
	// In development (HTTP), cookies don't have prefix: "openchat.session_token"
	const secureCookie = cookieStore.get("__Secure-openchat.session_token");
	const normalCookie = cookieStore.get("openchat.session_token");
	const sessionCookie = secureCookie || normalCookie;

	if (!sessionCookie?.value) {
		return NextResponse.json({ token: null }, { status: 200 });
	}

	return NextResponse.json({ token: sessionCookie.value }, { status: 200 });
}
