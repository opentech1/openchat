import { saveSession, getWorkOS } from "@workos-inc/authkit-nextjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const { code, token } = await request.json();

		if (!code || !token) {
			return NextResponse.json(
				{ error: "Verification code and token are required" },
				{ status: 400 }
			);
		}

		const workos = getWorkOS();

		// Authenticate with the email verification code
		const authResponse = await workos.userManagement.authenticateWithEmailVerification({
			clientId: process.env.WORKOS_CLIENT_ID!,
			code,
			pendingAuthenticationToken: token,
		});

		// Save the session
		await saveSession(
			{
				accessToken: authResponse.accessToken,
				refreshToken: authResponse.refreshToken,
				user: authResponse.user,
				impersonator: authResponse.impersonator,
			},
			request
		);

		return NextResponse.json({ success: true, user: authResponse.user });
	} catch (error: unknown) {
		console.error("[Auth] Email verification failed:", error);

		const err = error as { code?: string; message?: string };

		if (err?.code === "invalid_code") {
			return NextResponse.json(
				{ error: "Invalid verification code. Please check and try again." },
				{ status: 400 }
			);
		}

		if (err?.code === "expired_token") {
			return NextResponse.json(
				{ error: "Verification code has expired. Please sign in again." },
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{ error: "Verification failed. Please try again." },
			{ status: 500 }
		);
	}
}
