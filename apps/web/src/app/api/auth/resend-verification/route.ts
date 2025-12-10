import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const { email } = await request.json();

		if (!email) {
			return NextResponse.json(
				{ error: "Email is required" },
				{ status: 400 }
			);
		}

		const workos = getWorkOS();

		// Find the user by email
		const users = await workos.userManagement.listUsers({ email });

		if (users.data.length === 0) {
			// Don't reveal if user exists or not
			return NextResponse.json({ success: true });
		}

		const user = users.data[0];

		// Send new verification email
		await workos.userManagement.sendVerificationEmail({
			userId: user.id,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Auth] Resend verification failed:", error);
		return NextResponse.json(
			{ error: "Failed to resend verification email" },
			{ status: 500 }
		);
	}
}
