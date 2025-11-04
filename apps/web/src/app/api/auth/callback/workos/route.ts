import { NextRequest, NextResponse } from "next/server";
import { authenticateWithWorkOS } from "@/lib/workos";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const error = searchParams.get("error");

	// Handle OAuth errors
	if (error) {
		console.error("WorkOS OAuth error:", error);
		return NextResponse.redirect(
			new URL(`/auth/sign-in?error=${encodeURIComponent(error)}`, request.url),
		);
	}

	// Validate required parameters
	if (!code) {
		return NextResponse.redirect(
			new URL("/auth/sign-in?error=missing_code", request.url),
		);
	}

	try {
		// Exchange code for user information
		const { user, accessToken } = await authenticateWithWorkOS(code);

		// Create session cookie
		// For now, we'll store user info in a secure cookie
		// In production, you'd want to store this in your database and use a session token
		const cookieStore = await cookies();

		// Store session data (simplified - in production use proper session management)
		cookieStore.set("openchat.session-token", accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 60 * 60 * 24 * 7, // 7 days
			path: "/",
		});

		// Store user info (you should store this in your database)
		cookieStore.set(
			"openchat.user",
			JSON.stringify({
				id: user.id,
				email: user.email,
				name: `${user.firstName} ${user.lastName}`.trim(),
				image: user.profilePictureUrl,
			}),
			{
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: 60 * 60 * 24 * 7, // 7 days
				path: "/",
			},
		);

		// Redirect to dashboard
		return NextResponse.redirect(new URL("/dashboard", request.url));
	} catch (error) {
		console.error("WorkOS authentication error:", error);
		return NextResponse.redirect(
			new URL("/auth/sign-in?error=authentication_failed", request.url),
		);
	}
}
