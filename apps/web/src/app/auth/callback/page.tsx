"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NiceLoader } from "@/components/ui/nice-loader";

/**
 * Auth Callback Content Component
 *
 * Handles the OAuth callback for cross-domain authentication.
 * IMPORTANT: ConvexBetterAuthProvider automatically handles OTT verification
 * and cleans up the URL. This page just waits for the session to be established.
 */
function AuthCallbackContent() {
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		let cancelled = false;
		let attempts = 0;
		const maxAttempts = 10; // Try for up to 5 seconds (500ms * 10)

		const checkSession = async () => {
			try {
				// ConvexBetterAuthProvider handles OTT verification automatically
				// We just need to wait for the session to be established
				const session = await authClient.getSession();

				if (cancelled) return;

				if (session?.data?.user) {
					console.log("[Auth Callback] Session established, redirecting...");
					const from = searchParams.get("from") || "/dashboard";
					window.location.href = from;
					return;
				}

				// Session not ready yet, retry
				attempts++;
				if (attempts < maxAttempts) {
					console.log(`[Auth Callback] Waiting for session... (attempt ${attempts}/${maxAttempts})`);
					setTimeout(checkSession, 500);
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

		// Start checking after a brief delay to allow ConvexBetterAuthProvider
		// to process the OTT first
		const timer = setTimeout(checkSession, 100);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
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
