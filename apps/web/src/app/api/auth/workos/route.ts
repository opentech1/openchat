import { NextRequest, NextResponse } from "next/server";
import { getWorkOSAuthorizationUrl, type WorkOSProvider } from "@/lib/workos";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const provider = searchParams.get("provider") as WorkOSProvider;
	const redirectUri = searchParams.get("redirect_uri");
	const state = searchParams.get("state");

	if (!provider || !redirectUri || !state) {
		return NextResponse.json(
			{ error: "Missing required parameters" },
			{ status: 400 },
		);
	}

	// Validate provider
	if (provider !== "GoogleOAuth" && provider !== "GitHubOAuth") {
		return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
	}

	try {
		// Generate WorkOS authorization URL
		const authorizationUrl = getWorkOSAuthorizationUrl(
			provider,
			redirectUri,
			state,
		);

		// Redirect user to WorkOS
		return NextResponse.redirect(authorizationUrl);
	} catch (error) {
		console.error("WorkOS authorization error:", error);
		return NextResponse.json(
			{ error: "Failed to generate authorization URL" },
			{ status: 500 },
		);
	}
}
