"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NiceLoader } from "@/components/ui/nice-loader";

/**
 * Auth Callback Content Component
 *
 * Handles the OAuth callback for cross-domain authentication.
 *
 * NOTE: The middleware intercepts requests to /auth/callback with an OTT parameter
 * and redirects to /api/auth/callback-ott for server-side verification.
 * By the time this page loads, OTT verification is complete and cookies are set.
 * This page only needs to poll for the session and redirect to the dashboard.
 */
function AuthCallbackContent() {
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [checking, setChecking] = useState(true);

	// Extract params once to avoid dependency issues
	const from = searchParams.get("from");
	const errorParam = searchParams.get("error");

	useEffect(() => {
		let cancelled = false;

		// Handle error from server-side verification
		if (errorParam === "verification_failed") {
			setError("Authentication failed. Please try signing in again.");
			setChecking(false);
			return;
		}

		const checkSession = async () => {
			if (cancelled) return;

			let attempts = 0;
			const maxAttempts = 15; // Increased for more patience

			const poll = async () => {
				if (cancelled) return;

				try {
					const session = await authClient.getSession();

					if (session?.data?.user) {
						console.log("[Auth Callback] Session established, redirecting...");
						window.location.href = from || "/dashboard";
						return;
					}

					attempts++;
					if (attempts < maxAttempts) {
						console.log(`[Auth Callback] Waiting for session... (attempt ${attempts}/${maxAttempts})`);
						setTimeout(poll, 500);
					} else {
						console.error("[Auth Callback] Session not established after waiting");
						setError("Authentication is taking longer than expected. Please try signing in again.");
						setChecking(false);
					}
				} catch (err) {
					console.error("[Auth Callback] Error checking session:", err);
					if (!cancelled) {
						setError("An error occurred during authentication.");
						setChecking(false);
					}
				}
			};

			await poll();
		};

		// Start checking session - by this point OTT should be verified and cookies set
		checkSession();

		return () => {
			cancelled = true;
		};
	}, [from, errorParam]);

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
			<NiceLoader message={checking ? "Completing sign in..." : "Redirecting..."} size="lg" />
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
