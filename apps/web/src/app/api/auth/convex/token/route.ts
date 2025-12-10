import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/api/session-helpers";

// This endpoint provides a token for the Convex client to authenticate
// It reads the WorkOS AuthKit session and returns it as a token
export async function GET() {
	const sessionToken = await getSessionToken();

	if (!sessionToken) {
		return NextResponse.json({ token: null }, { status: 200 });
	}

	return NextResponse.json({ token: sessionToken }, { status: 200 });
}
