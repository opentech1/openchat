import { NextRequest, NextResponse } from "next/server";
import { splitCookiesString } from "set-cookie-parser";

/**
 * Server-side OTT verification handler
 *
 * This route verifies the One-Time Token (OTT) server-side and sets cookies
 * BEFORE any client-side JavaScript runs. This is critical because:
 *
 * 1. crossDomainClient plugin uses credentials: "omit" which doesn't set browser cookies
 * 2. Our middleware only checks browser cookies, not localStorage
 * 3. By verifying server-side, we can set cookies during the redirect
 *
 * Flow:
 * 1. Convex OAuth callback redirects to /auth/callback?ott=xxx
 * 2. Callback page detects OTT and redirects to this route
 * 3. This route verifies OTT and sets cookies
 * 4. Redirects back to /auth/callback (without OTT) with cookies set
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const ott = searchParams.get("ott");
	const from = searchParams.get("from");

	if (!ott) {
		// No OTT provided, redirect to sign-in
		return NextResponse.redirect(new URL("/auth/sign-in", request.url));
	}

	try {
		// Verify OTT by calling our own API route (which proxies to Convex)
		const verifyUrl = new URL(
			"/api/auth/cross-domain/one-time-token/verify",
			request.url
		);

		const verifyResponse = await fetch(verifyUrl.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ token: ott }),
		});

		// Build redirect URL
		const callbackUrl = new URL("/auth/callback", request.url);
		if (from) {
			callbackUrl.searchParams.set("from", from);
		}
		// Mark as verified so the callback page knows cookies should be set
		callbackUrl.searchParams.set("verified", "true");

		// Create redirect response
		const redirectResponse = NextResponse.redirect(callbackUrl);

		if (verifyResponse.ok) {
			// Extract Set-Cookie and Set-Better-Auth-Cookie headers from verify response
			// and add them to our redirect response

			// Handle Set-Better-Auth-Cookie header (from Convex crossDomain plugin)
			const betterAuthCookie = verifyResponse.headers.get(
				"Set-Better-Auth-Cookie"
			);
			if (betterAuthCookie) {
				const cookies = splitCookiesString(betterAuthCookie);
				for (const cookie of cookies) {
					// Strip Domain attribute - if it's .convex.site, it's invalid for our domain
					let sanitizedCookie = cookie.replace(/;\s*[Dd]omain=[^;]+/, "");

					// In development, strip Secure attribute so cookies work on HTTP localhost
					if (process.env.NODE_ENV !== "production") {
						sanitizedCookie = sanitizedCookie.replace(/;\s*[Ss]ecure/g, "");
						sanitizedCookie = sanitizedCookie.replace(/^__Secure-/i, "");
					}

					redirectResponse.headers.append("Set-Cookie", sanitizedCookie);
				}
			}

			// Also handle any Set-Cookie headers directly
			const setCookieHeader = verifyResponse.headers.get("Set-Cookie");
			if (setCookieHeader) {
				const cookies = splitCookiesString(setCookieHeader);
				for (const cookie of cookies) {
					// Strip Domain attribute
					let sanitizedCookie = cookie.replace(/;\s*[Dd]omain=[^;]+/, "");

					if (process.env.NODE_ENV !== "production") {
						sanitizedCookie = sanitizedCookie.replace(/;\s*[Ss]ecure/g, "");
						sanitizedCookie = sanitizedCookie.replace(/^__Secure-/i, "");
					}

					redirectResponse.headers.append("Set-Cookie", sanitizedCookie);
				}
			}
		}

		return redirectResponse;
	} catch (error) {
		console.error("[OTT Callback] Error verifying OTT:", error);

		// On error, redirect to callback page anyway - it will handle the error state
		const callbackUrl = new URL("/auth/callback", request.url);
		if (from) {
			callbackUrl.searchParams.set("from", from);
		}
		callbackUrl.searchParams.set("error", "verification_failed");

		return NextResponse.redirect(callbackUrl);
	}
}
