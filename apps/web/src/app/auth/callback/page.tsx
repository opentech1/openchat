"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NiceLoader } from "@/components/ui/nice-loader";

/**
 * Auth Callback Content Component
 *
 * Handles the one-time token (OTT) verification for cross-domain authentication.
 * When OAuth completes, the user is redirected here with an OTT parameter.
 * The crossDomainClient plugin automatically verifies the OTT and establishes the session cookie.
 * Once authenticated, the user is redirected to their intended destination.
 */
function AuthCallbackContent() {
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const verifyAndRedirect = async () => {
			try {
				// The crossDomainClient plugin automatically processes OTT from URL
				// and calls /api/auth/cross-domain/one-time-token/verify
				// This sets the session cookie on osschat.dev domain

				// Wait a moment for the OTT verification to complete
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Check if session is now established
				const session = await authClient.getSession();

				if (session?.data?.user) {
					// Session established, redirect to intended destination
					const from = searchParams.get("from") || "/dashboard";
					window.location.href = from;
				} else {
					// Wait a bit more and retry - OTT verification might still be in progress
					await new Promise((resolve) => setTimeout(resolve, 1500));

					const retrySession = await authClient.getSession();
					if (retrySession?.data?.user) {
						const from = searchParams.get("from") || "/dashboard";
						window.location.href = from;
					} else {
						// Still no session, something went wrong
						setError("Authentication failed. Please try signing in again.");
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
