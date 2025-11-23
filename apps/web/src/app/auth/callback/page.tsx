"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NiceLoader } from "@/components/ui/nice-loader";

/**
 * Auth Callback Content Component
 *
 * Handles the one-time token (OTT) verification for cross-domain authentication.
 * When OAuth completes, the user is redirected here with an OTT parameter.
 * We must MANUALLY call the verify endpoint - crossDomainClient does NOT do this automatically.
 * Once verified, the session cookie is established and user is redirected.
 */
function AuthCallbackContent() {
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const processingRef = useRef<string | null>(null);

	useEffect(() => {
		const verifyAndRedirect = async () => {
			try {
				// Get the OTT from URL - the crossDomain server plugin adds this after OAuth
				const ott = searchParams.get("ott");

				if (!ott) {
					console.error("[Auth Callback] No OTT parameter in URL");
					setError("Authentication failed - no token provided. Please try signing in again.");
					return;
				}

				// Prevent double-processing (React Strict Mode or duplicate effects)
				if (processingRef.current === ott) {
					console.log("[Auth Callback] Already processing this OTT, skipping...");
					return;
				}
				processingRef.current = ott;

				console.log("[Auth Callback] Verifying OTT...");

				// IMPORTANT: crossDomainClient does NOT automatically verify OTT
				// We must manually call the verify endpoint
				const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
				const verifyResponse = await fetch(`${baseUrl}/api/auth/cross-domain/one-time-token/verify`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ token: ott }),
					credentials: "include", // Important: include cookies in the response
				});

				if (!verifyResponse.ok) {
					const errorData = await verifyResponse.json().catch(() => ({}));
					console.error("[Auth Callback] OTT verification failed:", verifyResponse.status, errorData);
					
					// If verification failed (e.g. 400 Invalid Token), it implies the token might be already used.
					// This can happen if the effect fired twice or in race conditions.
					// We should check if we actually have a session now before showing an error.
					console.log("[Auth Callback] Checking if session exists despite verification failure...");
				} else {
					console.log("[Auth Callback] OTT verified, checking session...");
				}

				// Give the cookie a moment to be set
				await new Promise((resolve) => setTimeout(resolve, 100));

				// Check if session is now established
				const session = await authClient.getSession();

				if (session?.data?.user) {
					console.log("[Auth Callback] Session established, redirecting...");
					// Session established, redirect to intended destination
					const from = searchParams.get("from") || "/dashboard";
					window.location.href = from;
				} else {
					// Session not immediately available, try once more
					await new Promise((resolve) => setTimeout(resolve, 500));
					const retrySession = await authClient.getSession();

					if (retrySession?.data?.user) {
						const from = searchParams.get("from") || "/dashboard";
						window.location.href = from;
					} else {
						console.error("[Auth Callback] Session not established after OTT verification");
						// Only show error if we really don't have a session
						if (!verifyResponse.ok) {
							setError("Authentication failed. Please try signing in again.");
						} else {
							setError("Session establishment failed. Please try refreshing the page.");
						}
					}
				}
			} catch (err) {
				console.error("[Auth Callback] Error:", err);
				setError("An error occurred during authentication.");
			}
		};

		verifyAndRedirect();
	}, [searchParams]);

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center space-y-4">
					<p className="text-red-500">{error}</p>
					<button
						onClick={() => (window.location.href = "/auth/sign-in")}
						className="text-primary hover:underline"
					>
						Return to Sign In
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center">
			<NiceLoader message="Completing sign in..." size="lg" />
		</div>
	);
}

/**
 * Auth Callback Page
 *
 * Wrapped in Suspense as required by Next.js for useSearchParams
 */
export default function AuthCallbackPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<NiceLoader message="Loading..." size="lg" />
				</div>
			}
		>
			<AuthCallbackContent />
		</Suspense>
	);
}
